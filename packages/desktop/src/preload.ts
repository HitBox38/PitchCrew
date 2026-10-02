import { contextBridge, ipcRenderer } from 'electron';

// Expose only the notification operations, never the underlying Electron APIs.
contextBridge.exposeInMainWorld('pitchcrewNotifications', {
  show: (notification: unknown) => ipcRenderer.send('pitchcrew:notify', notification),
  onOpen: (listener: (id: string, target: string) => void) => {
    const handler = (_event: unknown, id: string, target: string) => listener(id, target);
    ipcRenderer.on('pitchcrew:notification-open', handler);
    return () => ipcRenderer.removeListener('pitchcrew:notification-open', handler);
  },
});
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
