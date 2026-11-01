import {
  app,
  clipboard,
  ClipboardItem,
  dialog,
  ipcMain,
  nativeImage,
  shell,
  type BrowserWindow,
} from 'electron';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { NativeGroup } from './pages.ts';

export const installBrowserArtifactIpc = (
  groups: Map<string, NativeGroup>,
  authorize: (event: Electron.IpcMainInvokeEvent) => void,
  getWindow: () => BrowserWindow | null,
) => {
  const saved = new Set<string>();
  ipcMain.handle('pitchcrew:browser:copy-capture', async (event, rawData: unknown) => {
    authorize(event);
    const data = z
      .string()
      .max(43_000_000)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/)
      .parse(rawData);
    const bytes = Buffer.from(data, 'base64');
    if (
      bytes.length < 24 ||
      bytes.length > 32_000_000 ||
      bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
    )
      throw new Error('The browser screenshot is invalid.');
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    if (!width || !height || width * height > 16_000_000)
      throw new Error('The browser screenshot is too large.');
    const image = nativeImage.createFromBuffer(bytes);
    if (image.isEmpty()) throw new Error('The browser screenshot could not be copied.');
    await clipboard.write([
      new ClipboardItem({
        'image/png': new Blob([new Uint8Array(image.toPNG())], { type: 'image/png' }),
      }),
    ]);
  });
  ipcMain.handle('pitchcrew:browser:capture', async (event, rawId: unknown) => {
    authorize(event);
    const group = groups.get(z.uuid().parse(rawId));
    const page = group?.pages.get(group.active);
    if (!group || !page || !group.bounds || group.manualUntil <= Date.now())
      throw new Error('Take control to capture this page.');
    const result = (await page.send('Page.captureScreenshot', { format: 'png' })) as {
      data: string;
    };
    if (
      group.manualUntil <= Date.now() ||
      group.pages.get(group.active) !== page ||
      page.contents.isDestroyed()
    )
      throw new Error('The browser page changed during capture.');
    const bytes = Buffer.from(result.data, 'base64');
    if (
      bytes.length < 24 ||
      bytes.length > 32_000_000 ||
      bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
    )
      throw new Error('The browser returned an invalid screenshot.');
    return {
      data: result.data,
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
      url: page.contents.getURL(),
      title: page.contents.getTitle(),
    };
  });
  ipcMain.handle(
    'pitchcrew:browser:save-artifact',
    async (event, rawKind: unknown, rawData: unknown) => {
      authorize(event);
      const kind = z.enum(['png', 'webm']).parse(rawKind);
      const data = z
        .string()
        .max(70_000_000)
        .regex(/^[A-Za-z0-9+/]*={0,2}$/)
        .parse(rawData);
      const bytes = Buffer.from(data, 'base64');
      if (
        !bytes.length ||
        bytes.length > 50_000_000 ||
        (kind === 'png'
          ? bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
          : bytes.subarray(0, 4).toString('hex') !== '1a45dfa3')
      )
        throw new Error('The browser artifact is invalid or too large.');
      const window = getWindow();
      if (!window || window.isDestroyed()) throw new Error('The desktop is unavailable.');
      const result = await dialog.showSaveDialog(window, {
        title: kind === 'png' ? 'Save browser screenshot' : 'Save browser recording',
        defaultPath: join(app.getPath('downloads'), `Pitchcrew-browser-${Date.now()}.${kind}`),
        filters: [{ name: kind === 'png' ? 'PNG image' : 'WebM video', extensions: [kind] }],
      });
      if (result.canceled || !result.filePath) return null;
      await writeFile(result.filePath, bytes);
      saved.add(result.filePath);
      return result.filePath;
    },
  );
  ipcMain.handle('pitchcrew:browser:reveal-artifact', (event, rawPath: unknown) => {
    authorize(event);
    const path = z.string().max(4096).parse(rawPath);
    if (!saved.has(path)) throw new Error('This browser artifact is unavailable.');
    shell.showItemInFolder(path);
  });
};
