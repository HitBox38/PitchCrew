import { app, BrowserWindow, nativeImage, nativeTheme, session } from 'electron';
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
function createWindow() {
  window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 860,
    minHeight: 620,
    title: 'Pitchcrew',
    icon: appIcon,
    // Matches the renderer's paper colour so the window never flashes before first paint.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1b1e' : '#f2f1ec',
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
          `(async () => {
            const response = await fetch('/api/snapshot', { headers: { 'x-pitchcrew-client': 'ui' } });
            const snapshot = await response.json();
            const waitFor = async (test) => {
              for (let i = 0; i < 80; i++) {
                if (test()) return true;
                await new Promise((resolve) => setTimeout(resolve, 100));
              }
              return false;
            };
            const uiReady = await waitFor(() => !!document.querySelector('main'));
            let chatReady = null, chatResponded = null, chatTabsReady = null;
            if (${JSON.stringify(process.env.PITCHCREW_SMOKE_CHAT === '1')}) {
              if (!snapshot.roles.every((role) => role.runtime === 'demo' && role.enabled)) throw new Error('Chat smoke test requires an isolated demo workspace.');
              [...document.querySelectorAll('button')].find((button) => button.textContent === 'Chat')?.click();
              chatReady = await waitFor(() => !!document.querySelector('textarea[aria-label="Message Scout"]'));
              [...document.querySelectorAll('button')].find((button) => button.textContent === 'Ask about this role')?.click();
              await waitFor(() => !!document.querySelector('textarea')?.value);
              document.querySelector('textarea')?.form?.requestSubmit();
              chatResponded = await waitFor(() => document.querySelector('.chat-transcript')?.textContent.includes('This is a demo reply.'));
              [...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent.includes('Crew work'))?.click();
              const workReady = await waitFor(() => document.querySelectorAll('[role="tabpanel"]').length === 1 && !!document.querySelector('.chat-work-content'));
              document.querySelector('.chat-thread .role-avatar.writer')?.closest('button')?.click();
              const writerReady = await waitFor(() => document.querySelectorAll('[role="tabpanel"]').length === 1 && !!document.querySelector('textarea[aria-label="Message Writer"]') && !!document.querySelector('.chat-empty'));
              document.querySelector('.chat-thread .role-avatar.scout')?.closest('button')?.click();
              await waitFor(() => !!document.querySelector('.chat-work-content'));
              [...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent.includes('Conversation'))?.click();
              chatTabsReady = workReady && writerReady && await waitFor(() => document.querySelectorAll('[role="tabpanel"]').length === 1 && !!document.querySelector('.chat-transcript'));
            }
            return { title: document.title, requireType: typeof require, apiStatus: response.status, cards: snapshot.cards.length, roles: snapshot.roles.length, uiReady, chatReady, chatResponded, chatTabsReady };
          })()`,
        );
        await new Promise((resolve) => setTimeout(resolve, 800));
        await writeFile(`${smokeFile}.png`, (await window!.webContents.capturePage()).toPNG());
        await writeFile(
          smokeFile,
          JSON.stringify({
            ...result,
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
