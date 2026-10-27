import type { DesktopBrowserBridge } from '../../core/src/native-browser.ts';
import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopUpdateBridge, DesktopUpdateState } from '../../core/src/desktop-updates.ts';
import { updateChannels } from './updates/ipc.ts';
import type { DesktopStartupBridge } from '../../core/src/desktop-startup.ts';
import { createLinkFeedbackBridge } from './link-feedback.ts';

const updates: DesktopUpdateBridge = {
  getState: () => ipcRenderer.invoke(updateChannels.state),
  check: () => ipcRenderer.invoke(updateChannels.check),
  download: () => ipcRenderer.invoke(updateChannels.download),
  install: () => ipcRenderer.invoke(updateChannels.install),
  subscribe: (listener) => {
    const receive = (_event: unknown, state: DesktopUpdateState) => listener(state);
    ipcRenderer.on(updateChannels.changed, receive);
    return () => {
      ipcRenderer.removeListener(updateChannels.changed, receive);
    };
  },
};
contextBridge.exposeInMainWorld('pitchcrewUpdates', updates);
const startup: DesktopStartupBridge = {
  getTiming: () => ipcRenderer.invoke('pitchcrew:startup:timing'),
};
contextBridge.exposeInMainWorld('pitchcrewStartup', startup);
const browser: DesktopBrowserBridge = {
  identify: () => ipcRenderer.invoke('pitchcrew:browser:identity'),
  focusPage: (id) => ipcRenderer.invoke('pitchcrew:browser:focus-page', id),
  focusControls: (id, focused) =>
    ipcRenderer.invoke('pitchcrew:browser:focus-controls', id, focused),
  mount: (id, bounds) => ipcRenderer.invoke('pitchcrew:browser:mount', id, bounds),
  find: (id, text, forward) => ipcRenderer.invoke('pitchcrew:browser:find', id, text, forward),
  subscribeShortcuts: (receive) => {
    const listener = (_event: unknown, shortcut: { id: string; key: string; shift: boolean }) =>
      receive(shortcut);
    ipcRenderer.on('pitchcrew:browser:shortcut', listener);
    return () => ipcRenderer.removeListener('pitchcrew:browser:shortcut', listener);
  },
};
contextBridge.exposeInMainWorld('pitchcrewBrowser', browser);

contextBridge.exposeInMainWorld('pitchcrewLinks', createLinkFeedbackBridge(ipcRenderer));

// Keep Electron APIs isolated; only narrow bridges and layout attributes reach the page.
window.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  root.dataset.desktop = process.platform;
  const syncTheme = () => {
    const theme = root.dataset.theme;
    if (theme !== 'light' && theme !== 'dark') return;
    let source = 'system';
    try {
      const saved = localStorage.getItem('pitchcrew-theme');
      if (saved === 'light' || saved === 'dark') source = saved;
    } catch {
      /* Match the renderer's system fallback when storage is unavailable. */
    }
    ipcRenderer.send('pitchcrew:theme', theme, source);
  };
  new MutationObserver(syncTheme).observe(root, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  syncTheme();
  ipcRenderer.on('pitchcrew:fullscreen', (_event, fullscreen: boolean) => {
    root.dataset.fullscreen = String(fullscreen);
  });
});
