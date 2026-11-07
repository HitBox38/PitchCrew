import type { BackgroundServiceInfo } from '@pitchcrew/core';

export interface ServiceBadge {
  label: string;
  success: boolean;
}

export const serviceBadges = ({ status, matches }: BackgroundServiceInfo): ServiceBadge[] => {
  if (!status.platform) return [{ label: 'Unavailable', success: false }];
  if (!status.installed) return [{ label: 'Not installed', success: false }];
  return [
    { label: matches ? 'Installed' : 'Installed for another workspace', success: matches },
    {
      label: status.running ? (matches ? 'Running' : 'Running elsewhere') : 'Stopped',
      success: matches && status.running,
    },
    ...(status.enabled ? [] : [{ label: 'Does not start at login', success: false }]),
  ];
};

export const serviceNotes = (info: BackgroundServiceInfo): string[] => {
  const { status } = info;
  if (!status.platform) return [status.detail];
  if (!status.installed)
    return [
      'Install the service to keep this workspace’s routines running after you close the window.',
    ];
  if (!info.matches)
    return [
      status.running
        ? 'The service is running for another workspace; it does not keep this workspace running after you close the window.'
        : 'The service is set up for another workspace; use it here to run this workspace at login.',
    ];
  if (info.startedByService)
    return [
      'This workspace’s background service keeps routines running after you close the window.',
    ];
  return [
    status.enabled
      ? 'The service will start this workspace at login; the current workspace was opened separately.'
      : 'This workspace’s service does not start at login; keep Pitchcrew running for scheduled routines.',
  ];
};

/** System details stay available in the diagnostic disclosure, beside the existing commands. */
export const serviceDiagnostics = (info: BackgroundServiceInfo): string[] => {
  const notes = [info.status.detail];
  if (info.status.installed && !info.matches)
    notes.push(
      `The installed service uses ${info.status.directory ?? 'another data folder'} on port ${info.status.port ?? 'unknown'}.`,
    );
  if (info.customLocation && !info.matches)
    notes.push('Installation uses this workspace’s data folder and port automatically.');
  return notes;
};

/** CLI commands worth showing for the current state, in the order to run them. */
export const serviceCommands = ({ status, matches, commands }: BackgroundServiceInfo): string[] => {
  if (!status.platform) return [];
  if (!status.installed) return [];
  if (!matches) return [commands.uninstall];
  return [commands.status, commands.logs, commands.uninstall];
};

/** The state bead: moss while this workspace's service runs, otherwise an empty socket. */
export const serviceRunning = ({ status, matches }: BackgroundServiceInfo): boolean =>
  !!status.platform && status.installed && matches && status.running;
