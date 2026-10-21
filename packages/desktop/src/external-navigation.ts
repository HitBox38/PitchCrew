import { dialog, shell, type BrowserWindow } from 'electron';
import { isAllowedExternalUrl } from './external-url.ts';

export const installExternalNavigation = (window: BrowserWindow, origin: string) => {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (
      isAppUrl(window.webContents.mainFrame.url, origin) &&
      !isAppUrl(url, origin) &&
      isAllowedExternalUrl(url)
    )
      void shell.openExternal(new URL(url).href).catch(() => {
        if (window.isDestroyed()) return;
        void dialog
          .showMessageBox(window, {
            type: 'error',
            title: 'Could not open link',
            message: 'Could not open this link in your browser.',
            detail: 'Copy the link and open it in your browser.',
          })
          .catch(() => {});
      });
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, target) => {
    if (!isAppUrl(target, origin)) event.preventDefault();
  });
};

const isAppUrl = (value: string, origin: string) => {
  try {
    return new URL(value).origin === origin;
  } catch {
    return false;
  }
};
