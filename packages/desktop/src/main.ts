import { app, BrowserWindow, ipcMain, nativeImage, nativeTheme, session, shell } from 'electron';
import { writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isGoogleAuthorizationUrl } from './external-url.ts';
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
            let chatReady = null, chatResponded = null, chatTabsReady = null, chatStreamingUpdates = null, routerHistoryReady = null;
            if (${JSON.stringify(process.env.PITCHCREW_SMOKE_CHAT === '1')}) {
              if (!snapshot.roles.every((role) => role.runtime === 'demo' && role.enabled)) throw new Error('Chat smoke test requires an isolated demo workspace.');
              document.querySelector('a[href="/chat"]')?.click();
              chatReady = await waitFor(() => location.pathname === '/chat/scout' && !!document.querySelector('textarea[aria-label="Message Scout"]'));
              [...document.querySelectorAll('button')].find((button) => button.textContent === 'Ask about this role')?.click();
              await waitFor(() => !!document.querySelector('textarea')?.value);
              const partials = new Set();
              const observer = new MutationObserver(() => {
                const message = document.querySelector('.chat-message-content[aria-busy="true"]');
                if (message?.textContent) partials.add(message.textContent);
              });
              observer.observe(document.querySelector('.chat-transcript'), { subtree: true, childList: true, characterData: true, attributes: true });
              document.querySelector('textarea')?.form?.requestSubmit();
              chatResponded = await waitFor(() => [...document.querySelectorAll('.chat-message-content[aria-busy="false"]')].some((message) => message.textContent.includes('This is a demo reply.')));
              observer.disconnect();
              chatStreamingUpdates = partials.size;
              [...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent.includes('Crew work'))?.click();
              const workReady = await waitFor(() => document.querySelectorAll('[role="tabpanel"]').length === 1 && !!document.querySelector('.chat-work-content'));
              document.querySelector('.chat-thread .role-avatar.writer')?.closest('button')?.click();
              const writerReady = await waitFor(() => document.querySelectorAll('[role="tabpanel"]').length === 1 && !!document.querySelector('textarea[aria-label="Message Writer"]') && !!document.querySelector('.chat-empty'));
              document.querySelector('.chat-thread .role-avatar.scout')?.closest('button')?.click();
              await waitFor(() => !!document.querySelector('.chat-work-content'));
              history.back();
              const backReady = await waitFor(() => location.pathname === '/chat/writer' && !!document.querySelector('textarea[aria-label="Message Writer"]'));
              history.forward();
              routerHistoryReady = backReady && await waitFor(() => location.pathname === '/chat/scout' && !!document.querySelector('.chat-work-content'));
              [...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent.includes('Conversation'))?.click();
              chatTabsReady = workReady && writerReady && await waitFor(() => document.querySelectorAll('[role="tabpanel"]').length === 1 && !!document.querySelector('.chat-transcript'));
            }
            return { title: document.title, requireType: typeof require, apiStatus: response.status, cards: snapshot.cards.length, roles: snapshot.roles.length, uiReady, chatReady, chatResponded, chatTabsReady, chatStreamingUpdates, routerHistoryReady };
          })()`,
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
