import type { BackgroundServiceInfo, BackgroundServiceStatus } from '@pitchcrew/core';
import { currentPlatform, currentServiceSpec, nodeServiceHost } from './host.ts';
import { createBackgroundService } from './index.ts';
import { homedir } from 'node:os';
import { pathFor, samePath } from './paths.ts';
import { defaultPort, repositoryRoot, type DaemonSettings } from './settings.ts';

export const unsupportedStatus: BackgroundServiceStatus = {
  platform: null,
  installed: false,
  enabled: false,
  running: false,
  pid: null,
  directory: null,
  port: null,
  definition: null,
  logFile: null,
  detail: 'The background service supports Windows, macOS and Linux.',
};

/** Reads this user's background service through the real service manager. */
export async function readBackgroundService(
  settings: DaemonSettings,
): Promise<BackgroundServiceStatus> {
  const spec = currentServiceSpec(settings);
  if (!spec) return unsupportedStatus;
  try {
    return await createBackgroundService(spec, nodeServiceHost).status();
  } catch (error) {
    return {
      ...unsupportedStatus,
      platform: spec.platform,
      detail: `Could not read the background service: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** Describes the background service relative to the daemon answering the request. */
export function backgroundServiceInfo(
  status: BackgroundServiceStatus,
  daemon: DaemonSettings & { service: boolean },
  home = homedir(),
): BackgroundServiceInfo {
  const platform = status.platform ?? currentPlatform() ?? 'linux';
  return {
    status,
    startedByService: daemon.service,
    matches:
      status.installed &&
      status.port === daemon.port &&
      samePath(platform, status.directory, daemon.directory),
    customLocation:
      daemon.port !== defaultPort ||
      !samePath(platform, daemon.directory, pathFor(platform).join(home, '.pitchcrew')),
    repository: repositoryRoot.replace(/[\\/]+$/, ''),
    commands: {
      install: 'pnpm service install',
      uninstall: 'pnpm service uninstall',
      status: 'pnpm service status',
      logs: 'pnpm service logs',
    },
  };
}
