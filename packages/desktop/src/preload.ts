import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopUpdateBridge, DesktopUpdateState } from '../../core/src/desktop-updates.ts';
import { updateChannels } from './updates/ipc.ts';
import type { DesktopStartupBridge } from '../../core/src/desktop-startup.ts';

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

// Keep Electron APIs isolated; only narrow update/timing bridges and layout attributes reach the page.
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
