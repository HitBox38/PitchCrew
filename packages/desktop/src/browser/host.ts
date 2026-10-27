import { createServer, type IncomingMessage } from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { ipcMain, session, type BrowserWindow } from 'electron';
import { z } from 'zod';
import {
  nativeBrowserCommandSchema,
  type DesktopBrowserHost,
} from '../../../core/src/native-browser.ts';
import { createNativeGroup, type NativeGroup } from './pages.ts';
import { connectBrowserRelay } from './cdp.ts';

const boundsSchema = z
  .object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    width: z.number().int().min(1).max(10000),
    height: z.number().int().min(1).max(10000),
  })
  .strict()
  .nullable();
export const createNativeBrowserHost = async (getWindow: () => BrowserWindow | null) => {
  const token = randomBytes(32).toString('hex');
  const ownerId = randomUUID();
  const groups = new Map<string, NativeGroup>();
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 4_000_000 });
  let origin = '';
  const authorize = (request: IncomingMessage) => {
    const supplied = request.headers.authorization?.replace(/^Bearer /, '') ?? '';
    return (
      !!origin &&
      /^[a-f0-9]{64}$/.test(supplied) &&
      request.headers.host === new URL(origin).host &&
      !request.headers.origin &&
      supplied.length === token.length &&
      timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
    );
  };
  const body = async (request: IncomingMessage): Promise<unknown> => {
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of request) {
      length += chunk.length;
      if (length > 16000) throw new Error('Browser command is too large.');
      chunks.push(Buffer.from(chunk));
    }
    return JSON.parse(Buffer.concat(chunks).toString() || '{}');
  };
  const server = createServer(async (request, response) => {
    if (!authorize(request)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const path = new URL(request.url!, origin).pathname;
      const parts = path.split('/').filter(Boolean);
      let result: unknown = { ok: true };
      if (path === '/sessions' && request.method === 'POST') {
        if (groups.size >= 32 || !getWindow())
          throw new Error('The desktop browser is unavailable.');
        const { profile } = z
          .object({ profile: z.string().regex(/^[a-f0-9]{64}$/) })
          .strict()
          .parse(await body(request));
        const group = createNativeGroup(ownerId, profile, getWindow, () => groups.values());
        groups.set(group.id, group);
        try {
          await group.create();
        } catch (error) {
          group.destroy();
          groups.delete(group.id);
          throw error;
        }
        result = {
          ...group.state(),
          endpoint: origin.replace('http:', 'ws:') + `/sessions/${group.id}/cdp`,
        };
      } else if (parts[0] === 'profiles' && request.method === 'DELETE') {
        const profile = z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .parse(parts[1]);
        for (const group of groups.values())
          if (group.profile === profile) {
            group.destroy();
            groups.delete(group.id);
          }
        await session.fromPartition(`persist:pitchcrew-browser-${profile}`).clearStorageData();
      } else {
        const group = groups.get(parts[1]);
        if (parts[0] !== 'sessions' || !group) throw new Error('Browser session is closed.');
        if (request.method === 'DELETE') {
          group.destroy();
          groups.delete(group.id);
        } else if (request.method === 'GET') result = group.state();
        else if (parts[2] === 'control') {
          const { manual, automatic } = z
            .object({ manual: z.boolean().optional(), automatic: z.boolean().optional() })
            .strict()
            .parse(await body(request));
          if (manual === false) {
            group.manualUntil = 0;
            result = { fingerprints: await group.manualFields.flush() };
            group.pages.get(group.active)?.contents.stopFindInPage('clearSelection');
          }
          if (manual !== undefined) {
            group.manualUntil = manual ? Date.now() + 45000 : 0;
            if (manual) {
              group.automatic = false;
              await Promise.all(
                [...group.pages.values()].map((page) =>
                  group.manualFields.begin(page.contents, group.manualUntil),
                ),
              );
            }
          }
          if (automatic !== undefined) {
            group.automatic = automatic;
            if (!automatic) group.preparationBlocked = false;
          }
          result = { ...(result as object), blocked: group.preparationBlocked };
        } else {
          const agent = parts[2] === 'agent-tabs';
          if (agent ? group.manualUntil > Date.now() : group.manualUntil <= Date.now())
            throw new Error('Browser control changed.');
          const command = nativeBrowserCommandSchema.parse(await body(request));
          if (agent && !['new-tab', 'select-tab', 'close-tab'].includes(command.kind))
            throw new Error('Unsupported agent tab command.');
          const page = group.pages.get(group.active)?.contents;
          if (command.kind === 'select-tab') group.select(command.tabId);
          if (command.kind === 'close-tab') {
            group.close(command.tabId);
            if (!group.pages.size) await group.create();
          }
          if (command.kind === 'new-tab') await group.create();
          if (command.kind === 'back' && page?.navigationHistory.canGoBack())
            page.navigationHistory.goBack();
          if (command.kind === 'forward' && page?.navigationHistory.canGoForward())
            page.navigationHistory.goForward();
          if (command.kind === 'reload') page?.reload();
          result = group.state();
        }
      }
      response
        .writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        .end(JSON.stringify(result));
    } catch {
      response
        .writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'The desktop browser command could not be completed.' }));
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 5000;
  server.on('upgrade', (request, socket, head) => {
    const match = /^\/sessions\/([^/]+)\/cdp$/.exec(request.url ?? '');
    const group = match && groups.get(match[1]);
    if (!group || !authorize(request)) {
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(request, socket, head, (connection) => {
      const relay = connectBrowserRelay(group, connection);
      group.relays.add(relay);
      connection.once('close', () => {
        group.relays.delete(relay);
        if (!group.relays.size && groups.get(group.id) === group) {
          group.manualUntil = 0;
          group.destroy();
          groups.delete(group.id);
        }
      });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Could not start the desktop browser.');
  origin = `http://127.0.0.1:${address.port}`;
  const descriptor: DesktopBrowserHost = { origin, token, ownerId };
  const mount = (id: string, value: unknown) => {
    const group = groups.get(id);
    if (!group) throw new Error('Browser session is closed.');
    const bounds = boundsSchema.parse(value);
    const window = getWindow();
    if (bounds && window) {
      const size = window.getContentBounds();
      if (bounds.x + bounds.width > size.width + 2 || bounds.y + bounds.height > size.height + 2)
        throw new Error('Browser bounds are outside the app window.');
      for (const other of groups.values()) if (other !== group) other.mount(null);
    }
    group.mount(bounds);
  };
  return {
    descriptor,
    groups,
    mount,
    closeGuests: () => {
      for (const group of groups.values()) group.destroy();
      groups.clear();
    },
    close: async () => {
      for (const group of groups.values()) group.destroy();
      groups.clear();
      for (const socket of sockets.clients) socket.terminate();
      sockets.close();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
};

export const installNativeBrowserIpc = (
  host: Awaited<ReturnType<typeof createNativeBrowserHost>>,
  getWindow: () => BrowserWindow | null,
  getOrigin: () => string,
) => {
  const authorize = (event: Electron.IpcMainInvokeEvent) => {
    const window = getWindow();
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !event.senderFrame ||
      new URL(event.senderFrame.url).origin !== getOrigin()
    )
      throw new Error('Desktop browser access is unavailable.');
  };
  ipcMain.handle('pitchcrew:browser:identity', (event) => {
    authorize(event);
    return host.descriptor.ownerId;
  });
  ipcMain.handle('pitchcrew:browser:focus-page', (event, id: unknown) => {
    authorize(event);
    const group = host.groups.get(z.uuid().parse(id));
    if (!group || group.manualUntil <= Date.now() || !group.bounds) return;
    if (getWindow()?.isFocused()) group.pages.get(group.active)?.contents.focus();
  });
  ipcMain.handle('pitchcrew:browser:focus-controls', (event, id: unknown, focused: unknown) => {
    authorize(event);
    const group = host.groups.get(z.uuid().parse(id));
    getWindow()?.webContents.setIgnoreMenuShortcuts(
      z.boolean().parse(focused) && !!group?.bounds && group.manualUntil > Date.now(),
    );
  });
  ipcMain.handle('pitchcrew:browser:mount', (event, id: unknown, bounds: unknown) => {
    authorize(event);
    host.mount(z.uuid().parse(id), bounds);
  });
  ipcMain.handle(
    'pitchcrew:browser:find',
    (event, id: unknown, text: unknown, forward: unknown) => {
      authorize(event);
      const group = host.groups.get(z.uuid().parse(id));
      const query = z.string().max(500).parse(text);
      const page = group?.pages.get(group.active)?.contents;
      if (!group || !page || (query && group.manualUntil <= Date.now()))
        throw new Error('Take control first.');
      if (query) page.findInPage(query, { forward: z.boolean().parse(forward), findNext: true });
      else page.stopFindInPage('clearSelection');
    },
  );
};
