import { BrowserWindow, ipcMain, screen, type WebContents } from 'electron';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { NativeGroup } from './pages.ts';
import { floatingContentSize } from './floating-layout.ts';
import { floatingBrowserHtml } from './floating-surface.ts';

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
const keySchema = z
  .object({
    type: z.enum(['keyDown', 'keyUp']),
    key: z.string().min(1).max(100),
    control: z.boolean(),
    meta: z.boolean(),
    alt: z.boolean(),
    shift: z.boolean(),
    isComposing: z.boolean(),
  })
  .strict();
export const installFloatingBrowserIpc = (
  groups: Map<string, NativeGroup>,
  authorize: (event: Electron.IpcMainInvokeEvent) => void,
  getWindow: () => BrowserWindow | null,
) => {
  const sources = new Map<
    WebContents,
    {
      group: NativeGroup;
      source: WebContents;
      window: BrowserWindow;
      key(input: z.infer<typeof keySchema>): void;
    }
  >();
  ipcMain.on('pitchcrew:browser:float-key', (event, value: unknown) => {
    const owned = sources.get(event.sender);
    const input = keySchema.safeParse(value);
    if (owned && event.senderFrame === event.sender.mainFrame && input.success)
      owned.key(input.data);
  });
  ipcMain.on('pitchcrew:browser:float-close', (event) => {
    const owned = sources.get(event.sender);
    if (owned && event.senderFrame === event.sender.mainFrame) owned.window.destroy();
  });
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
    const { workArea } = parent
      ? screen.getDisplayMatching(parent.getBounds())
      : screen.getPrimaryDisplay();
    const floating = new BrowserWindow({
      width: 640,
      height: 480,
      minWidth: Math.min(400, workArea.width),
      minHeight: Math.min(240, workArea.height),
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
    const close = () => {
      if (!floating.isDestroyed()) floating.destroy();
    };
    page.contents.once('destroyed', close);
    floating.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    floating.webContents.on('will-navigate', (navigation) => navigation.preventDefault());
    let keyboard = Promise.resolve();
    const key = (input: z.infer<typeof keySchema>) => {
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
    };
    sources.set(floatContents, { group, source: page.contents, window: floating, key });
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
    const capture = async () => {
      const result = (await page.send(
        'Page.captureScreenshot',
        { format: 'png' },
        undefined,
        `floating:${floating.id}`,
      )) as { data: string };
      const bytes = Buffer.from(result.data, 'base64');
      if (bytes.length < 24) throw new Error('No browser frame available.');
      return { ...result, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    };
    // Read the existing page; window sizing must never issue a guest resize or zoom.
    const initial = await capture().catch(() => null);
    if (closed) return;
    const outer = floating.getBounds();
    const inner = floating.getContentBounds();
    const chrome = { width: outer.width - inner.width, height: outer.height - inner.height };
    const size = floatingContentSize(initial ?? group.bounds ?? { width: 1280, height: 800 }, {
      width: Math.max(1, Math.floor(workArea.width * 0.92) - chrome.width),
      height: Math.max(1, Math.floor(workArea.height * 0.92) - chrome.height),
    });
    floating.setContentSize(size.width, size.height);
    floating.setPosition(
      Math.round(workArea.x + (workArea.width - size.width - chrome.width) / 2),
      Math.round(workArea.y + (workArea.height - size.height - chrome.height) / 2),
    );
    await floating.loadURL('data:text/html,' + encodeURIComponent(floatingBrowserHtml));
    if (closed) return;
    if (initial) floatContents.send('pitchcrew:browser:float-frame', initial);
    if (parent?.isVisible()) floating.showInactive();
    group.changed();
    const frame = async () => {
      if (closed || page.contents.isDestroyed()) return;
      try {
        if (group.manualUntil === 0 || group.manualUntil > Date.now()) {
          const result = await capture();
          if (!closed) floatContents.send('pitchcrew:browser:float-frame', result);
        }
      } catch {
        /* A navigation may invalidate a frame; the next tick follows the same guest. */
      }
      if (!closed) timer = setTimeout(() => void frame(), 150);
    };
    void frame();
  });
};
