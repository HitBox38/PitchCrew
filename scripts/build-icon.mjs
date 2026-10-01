import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Chromium rasterizes the actual SVG, including its filters, without a second design source.
if (!process.versions.electron) {
  const { default: electron } = await import('electron');
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-icon-'));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  try {
    const child = spawn(electron, [fileURLToPath(import.meta.url), directory], {
      env,
      stdio: 'inherit',
      windowsHide: true,
    });
    process.exitCode = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', (code) => resolve(code ?? 1));
    });
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  }
} else {
  const { app, BrowserWindow } = await import('electron');
  app.setPath('userData', process.argv[2]);
  app.on('window-all-closed', () => {});
  async function renderIcon() {
    let window;
    let exitCode = 0;
    try {
      const svg = await readFile(new URL('../packages/ui/public/favicon.svg', import.meta.url));
      await app.whenReady();
      window = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
      });
      await window.loadURL('data:text/html,<html lang="en"><title>Icon export</title></html>');
      const source = JSON.stringify(`data:image/svg+xml;base64,${svg.toString('base64')}`);
      const png = await window.webContents.executeJavaScript(`(async () => {
        const image = new Image();
        image.src = ${source};
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1024;
        canvas.getContext('2d').drawImage(image, 0, 0, 1024, 1024);
        return canvas.toDataURL('image/png').split(',')[1];
      })()`);
      const output = fileURLToPath(new URL('../packages/desktop/assets/icon.png', import.meta.url));
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, Buffer.from(png, 'base64'));
      console.log(`Exported 1024 × 1024 desktop icon to ${output}`);
    } catch (error) {
      console.error(error);
      exitCode = 1;
    } finally {
      window?.destroy();
      app.exit(exitCode);
    }
  }
  void renderIcon().catch((error) => {
    console.error(error);
    app.exit(1);
  });
}
