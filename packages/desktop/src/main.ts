import { app, BrowserWindow, ipcMain, nativeImage, nativeTheme, session } from 'electron';
import { writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
    },
  });
  window.once('ready-to-show', () => window?.show());
  window.on('enter-full-screen', () => window?.webContents.send('pitchcrew:fullscreen', true));
  window.on('leave-full-screen', () => window?.webContents.send('pitchcrew:fullscreen', false));
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, target) => {
    if (new URL(target).origin !== new URL(url).origin) event.preventDefault();
  });
  window.on('closed', () => {
    window = null;
  });
  const smokeFile = process.env.PITCHCREW_SMOKE_FILE;
  if (smokeFile)
    window.webContents.once('did-finish-load', async () => {
      try {
        const result = await window!.webContents.executeJavaScript(
          `(async()=>{const response=await fetch('/api/snapshot',{headers:{'x-pitchcrew-client':'ui'}});const snapshot=await response.json();for(let i=0;i<50&&!document.querySelector('main');i++)await new Promise(r=>setTimeout(r,100));return {title:document.title,requireType:typeof require,apiStatus:response.status,cards:snapshot.cards.length,roles:snapshot.roles.length,uiReady:!!document.querySelector('main')};})()`,
        );
        const chrome = [];
        const initialTheme = nativeTheme.themeSource;
        for (const theme of ['light', 'dark'] as const) {
          const layout = await window!.webContents.executeJavaScript(
            `(async()=>{localStorage.setItem('pitchcrew-theme','${theme}');document.documentElement.dataset.theme='${theme}';await new Promise(r=>setTimeout(r,100));const bar=document.querySelector('.desktop-titlebar');const sidebar=document.querySelector('[data-slot="sidebar-container"]');return {platform:document.documentElement.dataset.desktop,height:bar.getBoundingClientRect().height,background:getComputedStyle(bar).backgroundColor,dragRegion:getComputedStyle(bar).getPropertyValue('-webkit-app-region'),sidebarTop:sidebar.getBoundingClientRect().top,overflow:document.documentElement.scrollHeight>innerHeight};})()`,
          );
          chrome.push({ theme, ...layout, nativeTheme: nativeTheme.themeSource });
          await writeFile(
            `${smokeFile}.${theme}.png`,
            (await window!.webContents.capturePage()).toPNG(),
          );
        }
        await window!.webContents.executeJavaScript(
          `(()=>{const source='${initialTheme}';if(source==='system')localStorage.removeItem('pitchcrew-theme');else localStorage.setItem('pitchcrew-theme',source);document.documentElement.dataset.theme=source==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):source;})()`,
        );
        await new Promise((resolve) => setTimeout(resolve, 800));
        await writeFile(`${smokeFile}.png`, (await window!.webContents.capturePage()).toPNG());
        await writeFile(
          smokeFile,
          JSON.stringify({
            ...result,
            chrome,
            themeSourceRestored: nativeTheme.themeSource === initialTheme,
            iconLoaded: !appIcon.isEmpty(),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          }),
        );
        app.quit();
      } catch (error) {
        console.error(error);
        app.exit(1);
      }
    });
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
