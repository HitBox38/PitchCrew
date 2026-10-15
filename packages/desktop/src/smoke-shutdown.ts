import { app, type BrowserWindow } from 'electron';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

/** Isolated smoke evidence only; ordinary quits and renderer unload guards are unchanged. */
export function installSmokeShutdownCheck(window: BrowserWindow, file: string) {
  let requestedAt: number | undefined;
  let started = 0;
  const events: Record<string, number> = {};
  const record = (phase: string) => {
    if (requestedAt === undefined) return;
    events[phase] = performance.now() - started;
    try {
      writeFileSync(`${file}.shutdown.json`, JSON.stringify({ requestedAt, events }));
    } catch (error) {
      // Do not let an evidence failure open Electron's uncaught-error dialog.
      console.error('Could not write native smoke shutdown evidence:', error);
    }
  };
  window.on('close', () => record('windowClose'));
  window.on('closed', () => record('windowClosed'));
  app.on('will-quit', () => record('willQuit'));
  app.on('quit', () => record('quit'));
  return () => {
    requestedAt = Date.now();
    started = performance.now();
    record('requested');
    app.quit();
  };
}
