import type { AppUpdateInfo, DesktopUpdateState } from '@pitchcrew/core';

export const updateControl = (
  info: AppUpdateInfo | null,
  desktop: DesktopUpdateState | null,
  dismissed: string | null,
  checking: boolean,
) => {
  const native = desktop?.enabled ? desktop : null;
  const busy = native?.status === 'downloading' || native?.status === 'installing';
  const key = native ? native.availableVersion : info?.latest?.commit;
  const available = !!key && (native ? true : info?.status === 'available');
  const visible = available && (dismissed !== key || busy);
  const checkingNow = native?.status === 'checking' || checking;
  const disabled = busy || checkingNow || (!native && info?.status === 'disabled');
  const label = visible
    ? native?.status === 'installing'
      ? 'Restarting…'
      : native?.status === 'downloading'
        ? `Downloading… ${native.downloadPercent ?? 0}%`
        : native?.downloadedVersion
          ? 'Restart to update'
          : 'Download update'
    : checkingNow
      ? 'Checking for updates…'
      : info?.status === 'disabled'
        ? 'Update checks disabled'
        : 'Check for updates';
  // Native and daemon checks can finish separately or observe different published builds.
  const release = native && info?.latest?.version !== native.availableVersion ? null : info?.latest;
  return {
    visible,
    busy,
    disabled,
    checking: checkingNow,
    label,
    native,
    release,
    version: native?.availableVersion ?? release?.version,
    message: native?.message ?? info?.message,
    ready: !!native?.downloadedVersion,
    progress: native?.status === 'downloading' ? (native.downloadPercent ?? 0) : null,
  };
};

export const currentVersionLabel = (
  info: AppUpdateInfo | null,
  native: DesktopUpdateState | null,
) => {
  if (native?.enabled) return `Version ${native.currentVersion}`;
  if (!info) return 'Loading version…';
  const build = info.current.commit
    ? ` · Build ${info.current.commit.slice(0, 12)}`
    : ' · Build unknown';
  return `Version ${info.current.version}${build}${info.current.packaged ? '' : ' · Source checkout'}`;
};
export const updateStatusMessage = (
  info: AppUpdateInfo | null,
  native: DesktopUpdateState | null,
  loading: boolean,
  error: string | null,
) => {
  if (error) return error;
  if (loading) return 'Checking for updates…';
  return native?.enabled ? native.message : info?.message;
};
