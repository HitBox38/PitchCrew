import { dialog, session, type BrowserWindow } from 'electron';
import { waitForMaintenance } from './maintenance-quit.ts';

export const waitForRuntimeUpdates = async (
  origin: string,
  window: BrowserWindow | null,
): Promise<boolean> => {
  return waitForMaintenance({
    busy: async () => {
      try {
        const response = await session.defaultSession.fetch(`${origin}/api/runtimes/maintenance`, {
          headers: { 'x-pitchcrew-client': 'ui' },
          credentials: 'include',
          signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) return false;
        const state = (await response.json()) as {
          updates?: { operation?: { finishedAt: string | null } }[];
        };
        return (
          state.updates?.some((update) => update.operation && !update.operation.finishedAt) ?? false
        );
      } catch {
        return false;
      }
    },
    show: (signal, cancel) => {
      const options = {
        type: 'info' as const,
        title: 'Finishing runtime update…',
        message: 'Finishing runtime update…',
        detail:
          'Pitchcrew will quit when the installer and verification finish. You can cancel quitting and keep using the app.',
        buttons: ['Cancel quitting'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
        signal,
      };
      void (window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options))
        .then(() => {
          if (!signal.aborted) cancel();
        })
        .catch(() => {
          if (!signal.aborted) cancel();
        });
    },
    wait: () => new Promise((resolve) => setTimeout(resolve, 500)),
  });
};
