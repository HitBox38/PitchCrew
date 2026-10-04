import type { BackgroundServiceInfo } from '@pitchcrew/core';

export interface ServiceBadge {
  label: string;
  success: boolean;
}

export function serviceBadges({ status, matches }: BackgroundServiceInfo): ServiceBadge[] {
  if (!status.platform) return [{ label: 'Unavailable', success: false }];
  if (!status.installed) return [{ label: 'Not installed', success: false }];
  return [
    { label: matches ? 'Installed' : 'Installed for another folder', success: matches },
    { label: status.running ? 'Running' : 'Stopped', success: status.running },
    ...(status.enabled ? [] : [{ label: 'Does not start at login', success: false }]),
  ];
}

export function serviceNotes(info: BackgroundServiceInfo): string[] {
  const { status } = info;
  if (!status.platform) return [status.detail];
  const notes = [
    info.startedByService
      ? 'The background service started this daemon. It keeps running when you close the window.'
      : 'This daemon was started from a terminal or the desktop launcher, not the background service.',
  ];
  if (!status.installed) notes.push('Without it, routines run only while a daemon is open.');
  else if (!info.matches)
    notes.push(
      `The installed service runs ${status.directory ?? 'another data folder'} on port ${status.port ?? 'unknown'}.`,
    );
  if (info.customLocation && !info.matches)
    notes.push(
      'This daemon uses its own data folder or port. Set the same PITCHCREW_HOME and PITCHCREW_PORT in the shell before you install.',
    );
  return notes;
}

/** CLI commands worth showing for the current state, in the order to run them. */
export function serviceCommands({ status, matches, commands }: BackgroundServiceInfo): string[] {
  if (!status.platform) return [];
  if (!status.installed) return [commands.install, commands.status];
  if (!matches) return [commands.install, commands.uninstall];
  return [commands.status, commands.logs, commands.uninstall];
}
