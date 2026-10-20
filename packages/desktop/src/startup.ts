import { ipcMain, type BrowserWindow } from 'electron';
import { trustedUpdateSender } from './updates/ipc.ts';

/** One initial document in the first window can read the process launch clock once. */
export const installStartupTiming = (
  window: BrowserWindow,
  origin: string,
  daemonReadyMs: number,
) => {
  let navigations = 0;
  let consumed = false;
  window.webContents.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument && ++navigations > 1) consumed = true;
  });
  window.once('closed', () => {
    consumed = true;
  });
  ipcMain.handle(startupChannel, (event) => {
    if (consumed || !trustedUpdateSender(event, window.webContents, origin)) return null;
    consumed = true;
    return {
      duration_ms: Math.round(process.uptime() * 1000),
      daemon_ready_ms: Math.round(daemonReadyMs),
    };
  });
};

export const startupChannel = 'pitchcrew:startup:timing';
