import { BrowserWindow, ipcMain, type WebContents } from 'electron';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { NativeGroup } from './pages.ts';

const windows = new Map<number, BrowserWindow>();
export const browserIsFloating = (id: number) => windows.has(id);
export const closeFloatingBrowser = (group: NativeGroup) => {
  for (const contents of group.owned) windows.get(contents.id)?.destroy();
};
const mouseSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.enum(['mouseDown', 'mouseUp', 'mouseMove']),
      x: z.number().int().min(0).max(2560),
      y: z.number().int().min(0).max(2160),
      button: z.enum(['left', 'middle', 'right']),
      clickCount: z.number().int().min(1).max(3),
    })
    .strict(),
  z
    .object({
      type: z.literal('mouseWheel'),
      x: z.number().int().min(0).max(2560),
      y: z.number().int().min(0).max(2160),
      button: z.enum(['left', 'middle', 'right']),
      clickCount: z.number().int().min(1).max(3),
      deltaX: z.number().finite().min(-10000).max(10000),
      deltaY: z.number().finite().min(-10000).max(10000),
    })
    .strict(),
]);
export const installFloatingBrowserIpc = (
  groups: Map<string, NativeGroup>,
  authorize: (event: Electron.IpcMainInvokeEvent) => void,
  getWindow: () => BrowserWindow | null,
) => {
  const sources = new Map<WebContents, { group: NativeGroup; source: WebContents }>();
  ipcMain.on('pitchcrew:browser:float-input', (event, value: unknown) => {
    const owned = sources.get(event.sender);
    const input = mouseSchema.safeParse(value);
    if (
      !owned ||
      event.senderFrame !== event.sender.mainFrame ||
      !input.success ||
      owned.group.manualUntil <= Date.now() ||
      owned.source.isDestroyed()
    )
      return;
    owned.source.sendInputEvent(input.data);
  });
  ipcMain.handle('pitchcrew:browser:floating', async (event, rawId: unknown, rawOpen: unknown) => {
    authorize(event);
    const group = groups.get(z.uuid().parse(rawId));
    const open = z.boolean().parse(rawOpen);
    const page = group?.pages.get(group.active);
    if (!group || !page || group.manualUntil <= Date.now())
      throw new Error('Take control to open a separate browser window.');
    const current = windows.get(page.contents.id);
    if (!open) {
      current?.destroy();
      return;
    }
    if (current && !current.isDestroyed()) {
      if (getWindow()?.isVisible()) current.show();
      return;
    }
    const parent = getWindow();
    const floating = new BrowserWindow({
      width: 640,
      height: 480,
      title: 'Pitchcrew browser',
      show: false,
      autoHideMenuBar: true,
      ...(!parent?.isVisible() ? { focusable: false, skipTaskbar: true } : {}),
      webPreferences: {
        preload: fileURLToPath(new URL('./browser-floating-preload.cjs', import.meta.url)),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: false,
        backgroundThrottling: false,
      },
    });
    windows.set(page.contents.id, floating);
    const floatContents = floating.webContents;
    sources.set(floatContents, { group, source: page.contents });
    const close = () => {
      if (!floating.isDestroyed()) floating.destroy();
    };
    page.contents.once('destroyed', close);
    floating.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    floating.webContents.on('will-navigate', (navigation) => navigation.preventDefault());
    let keyboard = Promise.resolve();
    floating.webContents.on('before-input-event', (inputEvent, input) => {
      inputEvent.preventDefault();
      if (input.type !== 'keyDown' && input.type !== 'keyUp') return;
      const type = input.type;
      keyboard = keyboard
        .then(async () => {
          if (group.manualUntil <= Date.now() || page.contents.isDestroyed() || input.isComposing)
            return;
          await page.send(
            'Input.dispatchKeyEvent',
            {
              type,
              key: input.key,
              text:
                type === 'keyDown' && [...input.key].length === 1 && !input.control && !input.meta
                  ? input.key
                  : '',
              modifiers:
                (input.alt ? 1 : 0) |
                (input.control ? 2 : 0) |
                (input.meta ? 4 : 0) |
                (input.shift ? 8 : 0),
            },
            undefined,
            `floating:${floating.id}`,
          );
          if (!floating.isDestroyed()) floatContents.send('pitchcrew:browser:float-status', '');
        })
        .catch((error: unknown) => {
          if (!floating.isDestroyed())
            floatContents.send(
              'pitchcrew:browser:float-status',
              error instanceof Error
                ? error.message
                : 'This field needs the main browser view to have focus.',
            );
        });
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    floating.once('closed', () => {
      closed = true;
      clearTimeout(timer);
      windows.delete(page.contents.id);
      sources.delete(floatContents);
      page.contents.removeListener('destroyed', close);
      page.releaseAutomation?.(`floating:${floating.id}`);
      group.changed();
    });
    await floating.loadURL(
      'data:text/html,' +
        encodeURIComponent(
          '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'"><style>html,body{margin:0;width:100%;height:100%;background:#171717;overflow:hidden}#status{position:fixed;bottom:0;left:0;right:0;margin:0;padding:8px;color:#29251f;background:#f5f0e8;font:13px system-ui}#status:empty{display:none}img{width:100%;height:100%;object-fit:contain;user-select:none}</style></head><body><img draggable="false" alt="Live browser page"><p id="status" role="status"></p></body></html>',
        ),
    );
    if (parent?.isVisible()) floating.showInactive();
    group.changed();
    const frame = async () => {
      if (closed || page.contents.isDestroyed()) return;
      try {
        if (group.manualUntil === 0 || group.manualUntil > Date.now()) {
          const result = (await page.send(
            'Page.captureScreenshot',
            { format: 'png' },
            undefined,
            `floating:${floating.id}`,
          )) as { data: string };
          const bytes = Buffer.from(result.data, 'base64');
          if (!closed && bytes.length >= 24)
            floating.webContents.send('pitchcrew:browser:float-frame', {
              ...result,
              width: bytes.readUInt32BE(16),
              height: bytes.readUInt32BE(20),
            });
        }
      } catch {
        /* A navigation may invalidate a frame; the next tick follows the same guest. */
      }
      if (!closed) timer = setTimeout(() => void frame(), 150);
    };
    void frame();
  });
};
