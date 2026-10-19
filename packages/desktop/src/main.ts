import { waitForRuntimeUpdates } from './runtime-maintenance.ts';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeImage,
  nativeTheme,
  session,
  shell,
} from 'electron';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAllowedExternalUrl } from './external-url.ts';
import { installSmokeCheck } from './smoke.ts';
import { startPackagedDaemon, stopPackagedDaemon, ownsPackagedDaemon } from './packaged.ts';
import { registerDesktopUpdates } from './updates/index.ts';
import { installStartupTiming } from './startup.ts';

app.setName('Pitchcrew');
const hiddenSmoke =
  !!process.env.PITCHCREW_SMOKE_FILE && process.env.PITCHCREW_SMOKE_VISIBLE !== '1';
if (hiddenSmoke && process.platform === 'darwin') app.setActivationPolicy('accessory');
if (process.env.PITCHCREW_SMOKE_FILE)
  app.setPath('userData', dirname(process.env.PITCHCREW_SMOKE_FILE));
let url = process.env.PITCHCREW_URL ?? 'http://127.0.0.1:4417';
if (new URL(url).hostname !== '127.0.0.1')
  throw new Error('Pitchcrew only opens its loopback daemon.');
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
let window: BrowserWindow | null = null;
let daemonReady = !app.isPackaged;
let startupWindowCreated = false;
let daemonReadyMs = 0;
let updates: Awaited<ReturnType<typeof registerDesktopUpdates>> | undefined;
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
    ...(hiddenSmoke ? { focusable: false, skipTaskbar: true } : {}),
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
  if (!hiddenSmoke) window.once('ready-to-show', () => window?.show());
  window.on('enter-full-screen', () => window?.webContents.send('pitchcrew:fullscreen', true));
  window.on('leave-full-screen', () => window?.webContents.send('pitchcrew:fullscreen', false));
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (
      window &&
      new URL(window.webContents.mainFrame.url).origin === new URL(url).origin &&
      isAllowedExternalUrl(target)
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
  if (!startupWindowCreated) {
    startupWindowCreated = true;
    installStartupTiming(window, new URL(url).origin, daemonReadyMs);
  }
  void window.loadURL(url);
}
if (primaryInstance)
  void app
    .whenReady()
    .then(async () => {
      if (app.isPackaged) url = await startPackagedDaemon(process.resourcesPath);
      daemonReadyMs = process.uptime() * 1000;
      updates = await registerDesktopUpdates(
        () => window,
        () => new URL(url).origin,
      );
      daemonReady = true;
      if (process.platform === 'darwin') app.dock?.setIcon(appIcon);
      session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
        callback(false),
      );
      createWindow();
    })
    .catch((error: unknown) => {
      if (hiddenSmoke) {
        console.error('Pitchcrew smoke startup failed:', error);
        app.exit(1);
        return;
      }
      dialog.showErrorBox(
        'Pitchcrew could not start',
        error instanceof Error ? error.message : String(error),
      );
      app.quit();
    });
let maintenanceQuitApproved = false;
let checkingMaintenanceQuit = false;
app.on('before-quit', (event) => {
  const ownsDaemon = app.isPackaged
    ? ownsPackagedDaemon()
    : process.env.PITCHCREW_OWNS_DAEMON === '1';
  if (ownsDaemon && !maintenanceQuitApproved && !updates?.isInstalling()) {
    event.preventDefault();
    if (checkingMaintenanceQuit) return;
    checkingMaintenanceQuit = true;
    void waitForRuntimeUpdates(new URL(url).origin, window).then((proceed) => {
      checkingMaintenanceQuit = false;
      if (proceed) {
        maintenanceQuitApproved = true;
        app.quit();
      }
    });
    return;
  }
  if (!updates?.isInstalling()) stopPackagedDaemon();
});
app.on('second-instance', () => {
  if (hiddenSmoke) return;
  window?.restore();
  window?.focus();
});
app.on('activate', () => {
  if (daemonReady && !BrowserWindow.getAllWindows().length) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
