import { app, BrowserWindow, ipcMain, nativeImage, nativeTheme, session, shell } from 'electron';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isGoogleAuthorizationUrl } from './external-url.ts';
import { installSmokeCheck } from './smoke.ts';

app.setName('Pitchcrew');
if (process.env.PITCHCREW_SMOKE_FILE)
  app.setPath('userData', dirname(process.env.PITCHCREW_SMOKE_FILE));
const url = process.env.PITCHCREW_URL ?? 'http://127.0.0.1:4417';
if (new URL(url).hostname !== '127.0.0.1')
  throw new Error('Pitchcrew only opens its loopback daemon.');
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
let window: BrowserWindow | null = null;
const appIcon = nativeImage.createFromPath(
  fileURLToPath(new URL('../assets/icon.png', import.meta.url)),
);
// Keep these colours in sync with the renderer's paper and ink tokens.
const chromeColors = {
  light: { color: '#f2f1ec', symbolColor: '#2b2d31' },
  dark: { color: '#1a1b1e', symbolColor: '#e9e7e1' },
};
ipcMain.on('pitchcrew:theme', (event, theme: unknown, source: unknown) => {
  if (
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    !event.senderFrame ||
    new URL(event.senderFrame.url).origin !== new URL(url).origin ||
    (theme !== 'light' && theme !== 'dark') ||
    (source !== 'system' && source !== 'light' && source !== 'dark')
  )
    return;
  nativeTheme.themeSource = source;
  window.setBackgroundColor(chromeColors[theme].color);
  if (process.platform !== 'darwin') window.setTitleBarOverlay(chromeColors[theme]);
});
function createWindow() {
  window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 860,
    minHeight: 620,
    title: 'Pitchcrew',
    icon: appIcon,
    show: false,
    titleBarStyle: 'hidden',
    ...(process.platform === 'darwin'
      ? { trafficLightPosition: { x: 14, y: 13 } }
      : {
          titleBarOverlay: {
            ...chromeColors[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'],
            height: 40,
          },
        }),
    // Matches the renderer's paper colour so the window never flashes before first paint.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1b1e' : '#f2f1ec',
    autoHideMenuBar: true,
    webPreferences: {
      preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false,
    },
  });
  window.once('ready-to-show', () => window?.show());
  window.on('enter-full-screen', () => window?.webContents.send('pitchcrew:fullscreen', true));
  window.on('leave-full-screen', () => window?.webContents.send('pitchcrew:fullscreen', false));
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (
      window &&
      new URL(window.webContents.mainFrame.url).origin === new URL(url).origin &&
      isGoogleAuthorizationUrl(target)
    )
      void shell.openExternal(target).catch(() => {});
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, target) => {
    if (new URL(target).origin !== new URL(url).origin) event.preventDefault();
  });
  window.on('closed', () => {
    window = null;
  });
  installSmokeCheck(window, appIcon);
  void window.loadURL(url);
}
if (primaryInstance)
  void app.whenReady().then(() => {
    if (process.platform === 'darwin') app.dock?.setIcon(appIcon);
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false),
    );
    createWindow();
  });
app.on('second-instance', () => {
  window?.restore();
  window?.focus();
});
app.on('activate', () => {
  if (!BrowserWindow.getAllWindows().length) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
