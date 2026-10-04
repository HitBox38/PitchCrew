import type { BackgroundServicePlatform, BackgroundServiceStatus } from '@pitchcrew/core';
import { samePath } from './paths.ts';
import type { DaemonSettings } from './settings.ts';

export interface DaemonHealth {
  app: 'pitchcrew';
  service: boolean;
}

/**
 * How the desktop launcher gets a daemon. Only a daemon the launcher spawned is stopped when the
 * window closes; a running daemon or the background service keeps running.
 */
export type DaemonPlan =
  | { action: 'reuse'; owner: 'service' | 'other' }
  | { action: 'start-service' }
  | { action: 'spawn' };

type ServiceView = Pick<BackgroundServiceStatus, 'installed' | 'directory' | 'port'>;

export function planDaemon(
  health: DaemonHealth | null,
  service: ServiceView | null,
  settings: DaemonSettings,
  platform: BackgroundServicePlatform | null,
): DaemonPlan {
  if (health) return { action: 'reuse', owner: health.service ? 'service' : 'other' };
  if (
    platform &&
    service?.installed &&
    service.port === settings.port &&
    samePath(platform, service.directory, settings.directory)
  )
    return { action: 'start-service' };
  return { action: 'spawn' };
}

export const stopsOnExit = (plan: DaemonPlan) => plan.action === 'spawn';

export interface LauncherDeps {
  settings: DaemonSettings;
  platform: BackgroundServicePlatform | null;
  health(): Promise<DaemonHealth | null>;
  serviceStatus(): Promise<ServiceView | null>;
  startService(): Promise<void>;
  spawnDaemon(): { kill(): void };
  sleep(ms: number): Promise<void>;
  log(message: string): void;
  /** Readiness checks, 500 ms apart. First startup can load starter skills for 30 seconds. */
  attempts?: number;
}

/** Finds, starts or spawns the daemon for the desktop window. */
export async function prepareDaemon(deps: LauncherDeps) {
  const health = await deps.health();
  const service = health ? null : await deps.serviceStatus().catch(() => null);
  const plan = planDaemon(health, service, deps.settings, deps.platform);
  if (plan.action === 'reuse') {
    if (plan.owner === 'service') deps.log('Using the daemon run by the background service.');
    return { plan, child: null };
  }
  const waitForDaemon = async () => {
    for (let i = 0; i < (deps.attempts ?? 90); i++) {
      if (await deps.health()) return true;
      await deps.sleep(500);
    }
    return false;
  };
  if (plan.action === 'start-service') {
    deps.log('Starting the background service.');
    await deps.startService();
    if (!(await waitForDaemon()))
      throw new Error(
        'The background service did not start its daemon. Check pnpm service logs, or remove the service with pnpm service uninstall.',
      );
    return { plan, child: null };
  }
  const child = deps.spawnDaemon();
  if (!(await waitForDaemon())) {
    child.kill();
    throw new Error('The local daemon did not become ready.');
  }
  return { plan, child };
}
