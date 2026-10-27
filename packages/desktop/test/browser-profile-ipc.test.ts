import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { expect, it, vi } from 'vitest';
import { nativeProfiles } from '../src/browser/profiles.ts';
import { installNativeProfileIpc } from '../src/browser/profile-ipc.ts';
import type { createNativeBrowserHost } from '../src/browser/host.ts';
const mock = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, id: unknown, input: unknown) => Promise<unknown>>(),
  chosen: '',
  set: vi.fn(async (_cookie: unknown) => {}),
}));
vi.mock('electron', () => ({
  ipcMain: {
    handle: (name: string, handler: never) => mock.handlers.set(name, handler),
    removeHandler: (name: string) => mock.handlers.delete(name),
  },
  dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [mock.chosen] }) },
  session: {
    fromPartition: () => ({
      cookies: {
        get: async () => [],
        set: mock.set,
        flushStore: async () => {},
        remove: async () => {},
      },
      clearStorageData: async () => {},
      clearCache: async () => {},
    }),
  },
}));
vi.mock('../../mcp/src/computer/network.ts', () => ({ assertPublicUrl: vi.fn(async () => {}) }));

it('stages cookie values only in main, requires the same private controller and consumes reviewed imports once', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-profile-ipc-'));
  const profiles = await nativeProfiles(directory);
  const id = '8533d8c4-4846-4fe3-a1dd-3685cbd2f6f5';
  const group = {
    id,
    baseProfile: 'a'.repeat(64),
    profile: 'a'.repeat(64),
    namedProfile: { id: 'default', name: 'Default' },
    manualUntil: Date.now() + 45000,
  };
  const host = { groups: new Map([[id, group]]), profiles } as unknown as Awaited<
    ReturnType<typeof createNativeBrowserHost>
  >;
  const trusted = {} as IpcMainInvokeEvent;
  const stop = installNativeProfileIpc(
    host,
    (event) => {
      if (event !== trusted) throw new Error('Untrusted frame');
    },
    () => ({}) as BrowserWindow,
  );
  const call = (input: unknown, event = trusted) =>
    mock.handlers.get('pitchcrew:browser:profiles')!(event, id, input);
  mock.chosen = join(directory, 'cookies.json');
  await writeFile(
    mock.chosen,
    JSON.stringify([
      {
        domain: 'example.com',
        path: '/',
        name: 'fixture',
        value: 'fictional-private-cookie',
        secure: true,
      },
    ]),
  );
  try {
    const result = (await call({ kind: 'begin-import', id: 'default' })) as {
      preview: { token: string; count: number; domains: string[] };
    };
    expect(JSON.stringify(result)).not.toContain('fictional-private-cookie');
    expect(result.preview).toMatchObject({ count: 1, domains: ['example.com'] });
    expect(mock.set).not.toHaveBeenCalled();
    await expect(call({ kind: 'list' }, {} as IpcMainInvokeEvent)).rejects.toThrow('Untrusted');
    group.manualUntil = 0;
    await expect(call({ kind: 'confirm-import', token: result.preview.token })).rejects.toThrow(
      'Take control',
    );
    group.manualUntil = Date.now() + 45000;
    expect(await call({ kind: 'confirm-import', token: result.preview.token })).toMatchObject({
      imported: 1,
    });
    expect(mock.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'fixture', value: 'fictional-private-cookie' }),
    );
    await expect(call({ kind: 'confirm-import', token: result.preview.token })).rejects.toThrow(
      'expired',
    );
  } finally {
    stop();
    await rm(directory, { recursive: true, force: true });
  }
});
