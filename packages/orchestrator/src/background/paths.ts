import type { BackgroundServicePlatform } from '@pitchcrew/core';
import { posix, win32 } from 'node:path';
import { flagValue } from './settings.ts';
import type { ServiceSpec } from './types.ts';

export const serviceName = 'Pitchcrew';
export const launchdLabel = 'local.pitchcrew.daemon';
export const systemdUnit = 'pitchcrew.service';
export const serviceFolderName = 'background-service';
export const lockFileName = 'daemon.lock';

export const pathFor = (platform: BackgroundServicePlatform) =>
  platform === 'windows' ? win32 : posix;

/** Files the background service owns inside a data folder. */
export function serviceFiles(platform: BackgroundServicePlatform, directory: string) {
  const path = pathFor(platform);
  const folder = path.join(directory, serviceFolderName);
  return {
    folder,
    log: path.join(folder, 'daemon.log'),
    previousLog: path.join(folder, 'daemon.log.1'),
    launchdLog: path.join(folder, 'launchd.log'),
    task: path.join(folder, 'pitchcrew-task.xml'),
    lock: path.join(directory, lockFileName),
  };
}

/** Arguments after the Node executable for the production daemon run by the service. */
export function daemonArguments(spec: ServiceSpec) {
  return [
    '--import',
    'tsx',
    spec.cli,
    '--service',
    '--home',
    spec.directory,
    '--port',
    String(spec.port),
  ];
}

/** Data folder and port read back from installed daemon arguments. */
export function installedLocation(args: string[] | null) {
  const directory = args ? (flagValue(args, '--home') ?? null) : null;
  const port = args ? Number(flagValue(args, '--port')) : NaN;
  return { directory, port: Number.isInteger(port) ? port : null };
}

export function samePath(
  platform: BackgroundServicePlatform,
  a: string | null,
  b: string | null,
): boolean {
  if (!a || !b) return false;
  const path = pathFor(platform);
  const left = path.resolve(a);
  const right = path.resolve(b);
  return platform === 'windows' ? left.toLowerCase() === right.toLowerCase() : left === right;
}
