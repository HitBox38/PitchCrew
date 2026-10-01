import { app, BrowserWindow, session } from 'electron';
import { writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
app.setName('Pitchcrew');
if (process.env.PITCHCREW_SMOKE_FILE)
  app.setPath('userData', dirname(process.env.PITCHCREW_SMOKE_FILE));
const url = process.env.PITCHCREW_URL ?? 'http://127.0.0.1:4417';
if (new URL(url).hostname !== '127.0.0.1')
  throw new Error('Pitchcrew only opens its loopback daemon.');
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
let window: BrowserWindow | null = null;
function createWindow() {
  window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 860,
    minHeight: 620,
    title: 'Pitchcrew',
    backgroundColor: '#f1eadd',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
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
        await new Promise((resolve) => setTimeout(resolve, 800));
        await writeFile(`${smokeFile}.png`, (await window!.webContents.capturePage()).toPNG());
        await writeFile(
          smokeFile,
          JSON.stringify({
            ...result,
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
