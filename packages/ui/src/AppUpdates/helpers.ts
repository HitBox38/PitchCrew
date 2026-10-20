import type { AppUpdateInfo, DesktopUpdateState } from '@pitchcrew/core';

export function updateControl(
  info: AppUpdateInfo | null,
  desktop: DesktopUpdateState | null,
  dismissed: string | null,
  checking: boolean,
) {
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
}
