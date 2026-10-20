import type { DesktopUpdateState } from '../../../core/src/desktop-updates.ts';

export interface UpdateDriver {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowDowngrade: boolean;
  checkForUpdates(): Promise<{
    updateInfo: { version: string };
    isUpdateAvailable: boolean;
  } | null>;
  downloadUpdate(): Promise<string[]>;
  quitAndInstall(silent: boolean, restart: boolean): void;
  on(event: 'download-progress', listener: (value: { percent: number }) => void): unknown;
  on(event: 'error', listener: (value: Error) => void): unknown;
}

export interface UpdateDependencies {
  version: string;
  disabledReason: string | null;
  driver: UpdateDriver | null;
  emit(state: DesktopUpdateState): void;
  confirm(version: string): Promise<boolean>;
  prepare(version: string): Promise<void>;
  recover(): Promise<void>;
  installing(): void;
}

/** Serializes all updater actions; only a confirmed, fully downloaded update can stop work. */
export const createDesktopUpdater = (deps: UpdateDependencies) => {
  let state: DesktopUpdateState = {
    enabled: !deps.disabledReason,
    currentVersion: deps.version,
    status: deps.disabledReason ? 'disabled' : 'idle',
    availableVersion: null,
    downloadedVersion: null,
    downloadPercent: null,
    checkedAt: null,
    message: deps.disabledReason ?? 'Check for a newer Pitchcrew version.',
  };
  let busy = false;
  let recovering = false;
  let recovery: Promise<void> | null = null;
  const set = (patch: Partial<DesktopUpdateState>) => {
    state = { ...state, ...patch };
    deps.emit(state);
  };
  const failure = (operation: string) =>
    set({
      status: 'error',
      message: `Could not ${operation}. Try again or download the release manually.`,
    });
  const recoverInstallation = () => {
    if (recovery) return recovery;
    recovering = true;
    recovery = Promise.resolve()
      .then(() => deps.recover())
      .then(() => failure('install the update'))
      .catch(() => {
        set({
          status: 'error',
          message:
            'Installation failed and the daemon could not restart. Reopen Pitchcrew to recover.',
        });
      })
      .finally(() => {
        recovering = false;
      });
    return recovery;
  };
  if (deps.driver) {
    deps.driver.autoDownload = false;
    deps.driver.autoInstallOnAppQuit = false;
    deps.driver.allowDowngrade = false;
    deps.driver.on('download-progress', ({ percent }: { percent: number }) => {
      if (state.status === 'downloading' && Number.isFinite(percent))
        set({ downloadPercent: Math.max(0, Math.min(100, Math.floor(percent))) });
    });
    // Each awaited operation handles its error; this listener also prevents unhandled events.
    deps.driver.on('error', () => {
      if (state.status === 'installing') {
        void recoverInstallation();
      } else if (!busy) failure('check for updates');
    });
  }
  const run = async (action: () => Promise<void>) => {
    if (busy || recovering || state.status === 'installing' || !state.enabled || !deps.driver)
      return state;
    busy = true;
    try {
      await action();
    } finally {
      busy = false;
    }
    return state;
  };
  return {
    getState: () => state,
    check: () =>
      run(async () => {
        if (state.downloadedVersion) return;
        set({ status: 'checking', message: 'Checking for updates…' });
        try {
          const result = await deps.driver!.checkForUpdates();
          if (!result) throw new Error('No update result');
          set({
            status: result.isUpdateAvailable ? 'available' : 'current',
            availableVersion: result.isUpdateAvailable ? result.updateInfo.version : null,
            checkedAt: new Date().toISOString(),
            message: result.isUpdateAvailable
              ? `Version ${result.updateInfo.version} is ready to download.`
              : 'You are running the latest published version.',
          });
        } catch {
          failure('check for updates');
        }
      }),
    download: () =>
      run(async () => {
        if (!state.availableVersion || state.downloadedVersion) return;
        const version = state.availableVersion;
        set({ status: 'downloading', downloadPercent: 0, message: 'Downloading update…' });
        try {
          await deps.driver!.downloadUpdate();
          set({
            status: 'downloaded',
            downloadedVersion: version,
            downloadPercent: 100,
            message: `Version ${version} downloaded. Restart when you’re ready.`,
          });
        } catch {
          failure('download the update');
        }
      }),
    install: () =>
      run(async () => {
        if (!state.downloadedVersion) return;
        let prepared = false;
        try {
          if (!(await deps.confirm(state.downloadedVersion))) return;
          recovery = null;
          set({ status: 'installing', message: 'Stopping agents and restarting to install…' });
          // A partial preparation must also recover the service/daemon.
          prepared = true;
          await deps.prepare(state.downloadedVersion);
          deps.installing();
          deps.driver!.quitAndInstall(true, true);
        } catch {
          if (prepared) await recoverInstallation();
          else failure('install the update');
        }
      }),
  };
};
