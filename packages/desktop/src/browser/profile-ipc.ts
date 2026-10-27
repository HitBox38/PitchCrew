import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dialog, ipcMain, session, type BrowserWindow } from 'electron';
import { z } from 'zod';
import {
  browserProfilesCommandSchema,
  type BrowserProfilesState,
} from '../../../core/src/browser-profiles.ts';
import { assertPublicUrl } from '../../../mcp/src/computer/network.ts';
import { parseCookieExport, type ImportedCookie } from './cookie-import.ts';
import type { createNativeBrowserHost } from './host.ts';

export const installNativeProfileIpc = (
  host: Awaited<ReturnType<typeof createNativeBrowserHost>>,
  authorize: (event: Electron.IpcMainInvokeEvent) => void,
  getWindow: () => BrowserWindow | null,
) => {
  const staged = new Map<
    string,
    { groupId: string; profileId: string; expires: number; cookies: ImportedCookie[] }
  >();
  const busy = new Set<string>();
  const cleanup = setInterval(() => {
    for (const [token, item] of staged)
      if (item.expires <= Date.now() || !host.groups.has(item.groupId)) staged.delete(token);
  }, 30000);
  cleanup.unref();
  ipcMain.handle(
    'pitchcrew:browser:profiles',
    async (event, rawId: unknown, raw: unknown): Promise<BrowserProfilesState> => {
      authorize(event);
      const group = host.groups.get(z.uuid().parse(rawId));
      if (!group) throw new Error('Browser session is closed.');
      const command = browserProfilesCommandSchema.parse(raw);
      const manual = () => {
        if (host.groups.get(group.id) !== group || group.manualUntil <= Date.now())
          throw new Error('Take control of this browser first.');
      };
      const state = (): BrowserProfilesState => ({
        ...host.profiles.get(group.baseProfile),
        currentId: group.namedProfile.id,
      });
      if (command.kind === 'list') return state();
      manual();
      if (busy.has(group.baseProfile))
        throw new Error('A browser profile update is already in progress.');
      busy.add(group.baseProfile);
      try {
        for (const [token, item] of staged)
          if (item.expires <= Date.now() || !host.groups.has(item.groupId)) staged.delete(token);
        if (command.kind === 'cancel-import') {
          if (staged.get(command.token)?.groupId === group.id) staged.delete(command.token);
          return state();
        }
        if (command.kind === 'confirm-import') {
          const item = staged.get(command.token);
          if (!item || item.groupId !== group.id || item.expires <= Date.now())
            throw new Error('The import preview expired. Select the file again.');
          staged.delete(command.token);
          const partitionId = host.profiles.partition(group.baseProfile, item.profileId);
          if (
            [...host.groups.values()].some(
              (other) => other !== group && other.profile === partitionId,
            )
          )
            throw new Error('Close other browser sessions using this profile before importing.');
          try {
            const domains = [...new Set(item.cookies.map((cookie) => new URL(cookie.url).origin))];
            for (const domain of domains) await assertPublicUrl(domain);
            manual();
            const partition = session.fromPartition(`persist:pitchcrew-browser-${partitionId}`);
            const backup = await partition.cookies.get({});
            try {
              for (const cookie of item.cookies) {
                manual();
                await partition.cookies.set(cookie);
              }
              await partition.cookies.flushStore();
            } catch {
              for (const cookie of item.cookies)
                await partition.cookies.remove(cookie.url, cookie.name);
              for (const cookie of backup) {
                if (!cookie.domain) continue;
                await partition.cookies.set({
                  ...cookie,
                  url: `${cookie.secure ? 'https' : 'http'}://${cookie.domain.replace(/^\./, '')}${cookie.path}`,
                  ...(cookie.hostOnly ? { domain: undefined } : {}),
                });
              }
              await partition.cookies.flushStore();
              throw new Error('Cookie import failed.');
            }
            return { ...state(), imported: item.cookies.length };
          } catch {
            throw new Error(
              'The cookies could not be imported. Check the export and close other sessions using this profile.',
            );
          }
        }
        if (command.kind === 'begin-import') {
          const target = host.profiles
            .get(group.baseProfile)
            .profiles.find((profile) => profile.id === command.id);
          if (!target) throw new Error('Browser profile is unavailable.');
          const window = getWindow();
          if (!window) throw new Error('The desktop window is unavailable.');
          const chosen = await dialog.showOpenDialog(window, {
            title: 'Import website session cookies',
            buttonLabel: 'Review import',
            properties: ['openFile'],
            filters: [{ name: 'Cookie exports', extensions: ['json', 'txt'] }],
          });
          manual();
          if (chosen.canceled || !chosen.filePaths[0]) return state();
          try {
            const info = await stat(chosen.filePaths[0]);
            if (!info.isFile() || info.size > 1_000_000) throw new Error('Invalid export.');
            const parsed = parseCookieExport(await readFile(chosen.filePaths[0], 'utf8'));
            const token = randomUUID();
            for (const [previous, item] of staged)
              if (item.groupId === group.id) staged.delete(previous);
            if (staged.size >= 32) throw new Error('Too many previews.');
            staged.set(token, {
              groupId: group.id,
              profileId: command.id,
              expires: Date.now() + 300000,
              cookies: parsed.cookies,
            });
            return {
              ...state(),
              preview: {
                token,
                profileName: target.name,
                count: parsed.cookies.length,
                skipped: parsed.skipped,
                domains: parsed.domains,
              },
            };
          } catch {
            throw new Error(
              'Choose a valid JSON or Netscape cookie export, at most 1 MB and 1,000 cookies.',
            );
          }
        }
        if (command.kind === 'remove') {
          if (command.id === 'default')
            throw new Error('The default browser profile cannot be removed.');
          const partitionId = host.profiles.partition(group.baseProfile, command.id);
          if ([...host.groups.values()].some((other) => other.profile === partitionId))
            throw new Error('Close browser sessions using this profile before removing it.');
          const partition = session.fromPartition(`persist:pitchcrew-browser-${partitionId}`);
          await partition.clearStorageData();
          await partition.clearCache();
          manual();
        }
        await host.profiles.update(group.baseProfile, (record) => {
          if (command.kind === 'create') {
            if (record.profiles.length >= 20)
              throw new Error('Each agent supports up to 20 browser profiles.');
            if (
              record.profiles.some(
                (profile) => profile.name.toLowerCase() === command.name.toLowerCase(),
              )
            )
              throw new Error('Choose a different browser profile name.');
            record.profiles.push({ id: randomUUID(), name: command.name });
          } else {
            const profile = record.profiles.find(
              (item) => item.id === ('id' in command ? command.id : ''),
            );
            if (!profile) throw new Error('Browser profile is unavailable.');
            if (command.kind === 'rename') profile.name = command.name;
            if (command.kind === 'select') record.selectedId = command.id;
            if (command.kind === 'remove') {
              record.profiles = record.profiles.filter((item) => item.id !== command.id);
              if (record.selectedId === command.id) record.selectedId = 'default';
            }
          }
        });
        for (const other of host.groups.values())
          if (other.baseProfile === group.baseProfile) {
            const profile = host.profiles
              .get(group.baseProfile)
              .profiles.find((item) => item.id === other.namedProfile.id);
            if (profile) other.namedProfile = profile;
          }
        return state();
      } finally {
        busy.delete(group.baseProfile);
      }
    },
  );
  return () => {
    clearInterval(cleanup);
    staged.clear();
    ipcMain.removeHandler('pitchcrew:browser:profiles');
  };
};
