import { checkAppUpdate, loadAppUpdate } from '../AppUpdates/api.ts';
import type { AppUpdateInfo, DesktopUpdateState } from '@pitchcrew/core';
import { desktopUpdateBridge } from '../AppUpdates/desktop.ts';
import { analytics } from '../Analytics/client.ts';
import { desktopUpdateEvent } from '../Analytics/desktop-updates.ts';
import type { WorkspaceGet, WorkspaceSet } from './types.ts';

export interface AppUpdateState {
  desktopUpdate: DesktopUpdateState | null;
  setDesktopUpdate: (desktopUpdate: DesktopUpdateState) => void;
  downloadDesktopUpdate: () => Promise<void>;
  installDesktopUpdate: () => Promise<void>;
  appUpdate: AppUpdateInfo | null;
  checkingAppUpdate: boolean;
  appUpdateError: string;
  loadAppUpdate: () => Promise<void>;
  checkAppUpdate: (manual?: boolean) => Promise<void>;
  dismissedAppUpdate: string | null;
  dismissAppUpdate: () => void;
}

export const createAppUpdateActions = (set: WorkspaceSet, get: WorkspaceGet): AppUpdateState => {
  let pending: Promise<void> | null = null;
  const run = (load: () => Promise<AppUpdateInfo>) => {
    if (pending) return pending;
    set({ checkingAppUpdate: true, appUpdateError: '' });
    pending = load()
      .then((appUpdate) => set({ appUpdate }))
      .catch(() => {
        set({ appUpdateError: 'Could not reach the local daemon to check for updates.' });
      })
      .finally(() => {
        pending = null;
        set({ checkingAppUpdate: false });
      });
    return pending;
  };
  return {
    desktopUpdate: null,
    setDesktopUpdate: (desktopUpdate) => {
      const event = desktopUpdateEvent(get().desktopUpdate, desktopUpdate);
      set({ desktopUpdate });
      if (event) analytics.capture(event);
    },
    downloadDesktopUpdate: async () => {
      try {
        set({ dismissedAppUpdate: null });
        const desktopUpdate = await desktopUpdateBridge()?.download();
        if (desktopUpdate) get().setDesktopUpdate(desktopUpdate);
      } catch {
        get().setToast('Could not download the update. Try again.', 'error');
      }
    },
    installDesktopUpdate: async () => {
      try {
        const desktopUpdate = await desktopUpdateBridge()?.install();
        if (desktopUpdate) get().setDesktopUpdate(desktopUpdate);
      } catch {
        get().setToast('Could not install the update. Try again.', 'error');
      }
    },
    appUpdate: null,
    checkingAppUpdate: false,
    appUpdateError: '',
    dismissedAppUpdate: null,
    loadAppUpdate: async () => {
      if (!get().desktopUpdate) {
        const desktopUpdate = await desktopUpdateBridge()
          ?.getState()
          .catch(() => undefined);
        if (desktopUpdate) set({ desktopUpdate });
      }
      if (!get().appUpdate) await run(loadAppUpdate);
    },
    checkAppUpdate: async (manual = true) => {
      await run(async () => {
        const native = get().desktopUpdate?.enabled ? desktopUpdateBridge() : undefined;
        const [appUpdate, desktopUpdate] = await Promise.all([
          checkAppUpdate(manual),
          native?.check(),
        ]);
        if (desktopUpdate) set({ desktopUpdate });
        return appUpdate;
      });
      if (
        manual &&
        !get().appUpdateError &&
        (get().appUpdate?.status === 'available' || get().desktopUpdate?.availableVersion)
      )
        set({ dismissedAppUpdate: null });
    },
    dismissAppUpdate: () =>
      set({
        dismissedAppUpdate: get().desktopUpdate?.enabled
          ? (get().desktopUpdate?.availableVersion ?? null)
          : (get().appUpdate?.latest?.commit ?? null),
      }),
  };
};
