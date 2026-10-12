import { app, dialog, ipcMain, type BrowserWindow } from 'electron';
import type { AppUpdater } from 'electron-updater';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkGitHubRelease } from '../../../orchestrator/src/app-updates/github.ts';
import { canUpdatePackagedDaemon, requestDaemonUpdate } from '../packaged.ts';
import { createDesktopUpdater, type UpdateDriver } from './controller.ts';
import { trustedUpdateSender, updateChannels } from './ipc.ts';

const feed = 'https://github.com/HitBox38/PitchCrew/releases';

async function disabledReason() {
  if (!app.isPackaged) return 'Source launches use the release page to update.';
  if (process.env.PITCHCREW_SMOKE_FILE || process.env.PITCHCREW_UPDATE_CHECKS === '0')
    return 'Installation update checks are disabled.';
  if (process.platform === 'darwin')
    return 'This unsigned Mac build uses manual installation from the release page.';
  if (process.platform === 'linux' && !process.env.APPIMAGE) {
    const type = await readFile(join(process.resourcesPath, 'package-type'), 'utf8').catch(
      () => '',
    );
    if (type.trim() !== 'deb')
      return 'Use an installed AppImage or Debian package to update in the app.';
  }
  if (!canUpdatePackagedDaemon())
    return 'Close the separately running daemon and reopen Pitchcrew to update in the app.';
  return null;
}

/** Resolves a validated SHA release before each check so a later release cannot change the download. */
function updateDriver(): UpdateDriver {
  const require = createRequire(join(process.resourcesPath, 'runtime', 'package.json'));
  const { autoUpdater } = require('electron-updater') as { autoUpdater: AppUpdater };
  const check = autoUpdater.checkForUpdates.bind(autoUpdater);
  autoUpdater.checkForUpdates = async () => {
    const { latest } = await checkGitHubRelease(null, fetch, AbortSignal.timeout(10_000));
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: `${feed}/download/build-${latest.commit}/`,
      channel: `latest-${process.arch}`,
      useMultipleRangeRequest: false,
    });
    return check();
  };
  return autoUpdater;
}

export async function registerDesktopUpdates(
  getWindow: () => BrowserWindow | null,
  origin: () => string,
) {
  let installing = false;
  let reason = await disabledReason();
  let driver: UpdateDriver | null = null;
  if (!reason) {
    try {
      driver = updateDriver();
    } catch {
      reason = 'The updater is unavailable. Download the release manually.';
    }
  }
  const updates = createDesktopUpdater({
    version: app.getVersion(),
    disabledReason: reason,
    driver,
    emit: (state) => getWindow()?.webContents.send(updateChannels.changed, state),
    async confirm(version) {
      const window = getWindow();
      if (!window) return false;
      const result = await dialog.showMessageBox(window, {
        type: 'question',
        title: 'Install Pitchcrew update',
        message: `Install version ${version} and restart Pitchcrew?`,
        detail:
          'Running agents will be interrupted. Your board, chats, profile and packets will be kept.',
        buttons: ['Cancel', 'Install and restart'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      return result.response === 1;
    },
    prepare: (version) => requestDaemonUpdate('prepare-update', version),
    async recover() {
      installing = false;
      await requestDaemonUpdate('recover-update');
    },
    installing: () => {
      installing = true;
    },
  });
  const actions = {
    state: updates.getState,
    check: updates.check,
    download: updates.download,
    install: updates.install,
  };
  for (const [name, action] of Object.entries(actions)) {
    ipcMain.handle(updateChannels[name as keyof typeof actions], (event, ...args: unknown[]) => {
      const window = getWindow();
      if (!window || args.length || !trustedUpdateSender(event, window.webContents, origin()))
        throw new Error('Update action denied.');
      return action();
    });
  }
  return { isInstalling: () => installing };
}
