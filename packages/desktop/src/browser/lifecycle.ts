import type { BrowserWindow } from 'electron';
import { createNativeBrowserHost, installNativeBrowserIpc } from './host.ts';

export const startNativeBrowsers = async (
  getWindow: () => BrowserWindow | null,
  getOrigin: () => string,
) => {
  const host = await createNativeBrowserHost(getWindow);
  installNativeBrowserIpc(host, getWindow, getOrigin);
  const register = async () => {
    const window = getWindow();
    if (
      !window ||
      window.webContents.isDestroyed() ||
      new URL(window.webContents.getURL() || 'about:blank').origin !== getOrigin()
    )
      return;
    const cookies = await window.webContents.session.cookies.get({
      url: getOrigin(),
      name: 'pitchcrew_session',
    });
    const cookie = cookies[0];
    if (!cookie) return;
    await fetch(`${getOrigin()}/api/browser-host`, {
      method: 'POST',
      headers: {
        'x-pitchcrew-client': 'ui',
        'content-type': 'application/json',
        cookie: `${cookie.name}=${cookie.value}`,
      },
      body: JSON.stringify(host.descriptor),
      signal: AbortSignal.timeout(3000),
    });
  };
  const timer = setInterval(() => void register().catch(() => {}), 5000);
  timer.unref();
  return {
    ...host,
    register,
    close: async () => {
      clearInterval(timer);
      await host.close();
    },
  };
};
