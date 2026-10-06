import { checkAppUpdate, loadAppUpdate } from '../AppUpdates/api.ts';
import type { AppUpdateInfo } from '@pitchcrew/core';
import type { WorkspaceGet, WorkspaceSet } from './types.ts';

export interface AppUpdateState {
  appUpdate: AppUpdateInfo | null;
  checkingAppUpdate: boolean;
  appUpdateError: string;
  loadAppUpdate: () => Promise<void>;
  checkAppUpdate: (manual?: boolean) => Promise<void>;
  dismissedAppUpdate: string | null;
  dismissAppUpdate: () => void;
}

export function createAppUpdateActions(set: WorkspaceSet, get: WorkspaceGet): AppUpdateState {
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
    appUpdate: null,
    checkingAppUpdate: false,
    appUpdateError: '',
    dismissedAppUpdate: null,
    loadAppUpdate: () => (get().appUpdate ? Promise.resolve() : run(loadAppUpdate)),
    checkAppUpdate: (manual = true) => run(() => checkAppUpdate(manual)),
    dismissAppUpdate: () => set({ dismissedAppUpdate: get().appUpdate?.latest?.commit ?? null }),
  };
}
