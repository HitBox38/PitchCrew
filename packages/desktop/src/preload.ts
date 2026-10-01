import { ipcRenderer } from 'electron';

// Keep Electron APIs in the isolated preload; the page only sees layout attributes.
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
