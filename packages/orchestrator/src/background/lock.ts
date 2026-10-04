import { randomUUID } from 'node:crypto';
import { open, readFile, rm, stat } from 'node:fs/promises';
import { uptime } from 'node:os';
import { join } from 'node:path';
import { lockFileName } from './paths.ts';
import { withLockMutation } from './lock-mutation.ts';

/** Contents of daemon.lock in the data folder while a daemon owns it. */
export interface DaemonLock {
  pid: number;
  port: number;
  service: boolean;
  startedAt: string;
  bootedAt: string;
  token: string;
}

export interface LockChecks {
  isAlive(pid: number): boolean;
  /** Whether a Pitchcrew daemon answers on the port. */
  answers(port: number): Promise<boolean>;
  now(): number;
  bootTime(): number;
}

/** A daemon still starting may not listen yet; after this it must answer to keep the lock. */
const startupGrace = 5 * 60_000;
/** Boot times from os.uptime() drift slightly; a larger difference means a reboot. */
const bootTolerance = 2 * 60_000;

export class DaemonRunningError extends Error {
  constructor(readonly holder: DaemonLock) {
    super(
      `Pitchcrew is already running for this data folder at http://127.0.0.1:${holder.port} (process ${holder.pid}${holder.service ? ', background service' : ''}).`,
    );
  }
}

export function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to someone else.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** Fetches /api/health; null when nothing or something other than Pitchcrew answers. */
export async function probeDaemon(port: number, timeout = 1000) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(timeout),
    });
    const data = (await response.json()) as { app?: string; service?: boolean };
    return data.app === 'pitchcrew' ? { app: 'pitchcrew' as const, service: !!data.service } : null;
  } catch {
    return null;
  }
}

export const defaultLockChecks: LockChecks = {
  isAlive: isProcessAlive,
  answers: async (port) => !!(await probeDaemon(port)),
  now: () => Date.now(),
  bootTime: () => Date.now() - uptime() * 1000,
};

export function parseDaemonLock(text: string): DaemonLock | null {
  try {
    const value = JSON.parse(text) as Partial<DaemonLock>;
    if (!Number.isInteger(value.pid) || !Number.isInteger(value.port) || !value.token) return null;
    return {
      pid: value.pid!,
      port: value.port!,
      service: value.service === true,
      startedAt: String(value.startedAt ?? ''),
      bootedAt: String(value.bootedAt ?? ''),
      token: value.token,
    };
  } catch {
    return null;
  }
}

/** Whether the process recorded in a lock still owns the data folder. */
export async function lockHeld(lock: DaemonLock, checks: LockChecks = defaultLockChecks) {
  if (!checks.isAlive(lock.pid)) return false;
  // A process ID recorded before a restart can belong to an unrelated process now.
  const bootedAt = Date.parse(lock.bootedAt);
  if (Number.isFinite(bootedAt) && Math.abs(bootedAt - checks.bootTime()) > bootTolerance)
    return false;
  const startedAt = Date.parse(lock.startedAt);
  if (Number.isFinite(startedAt) && checks.now() - startedAt < startupGrace) return true;
  return checks.answers(lock.port);
}

/** The daemon currently holding the data folder, if any. */
export async function readDaemonLock(directory: string, checks: LockChecks = defaultLockChecks) {
  try {
    const lock = parseDaemonLock(await readFile(join(directory, lockFileName), 'utf8'));
    return lock && (await lockHeld(lock, checks)) ? lock : null;
  } catch {
    return null;
  }
}

/**
 * Claims the data folder for one daemon. A second daemon on the same folder is refused before it
 * opens the board, so it cannot mark the first daemon's active runs as interrupted. Locks left by
 * a crash are replaced.
 */
export async function acquireDaemonLock(
  directory: string,
  options: { port: number; service: boolean },
  checks: LockChecks = defaultLockChecks,
) {
  return withLockMutation(directory, () => claimDaemonLock(directory, options, checks));
}

async function claimDaemonLock(
  directory: string,
  options: { port: number; service: boolean },
  checks: LockChecks,
) {
  const file = join(directory, lockFileName);
  const lock: DaemonLock = {
    pid: process.pid,
    port: options.port,
    service: options.service,
    startedAt: new Date(checks.now()).toISOString(),
    bootedAt: new Date(checks.bootTime()).toISOString(),
    token: randomUUID(),
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const handle = await open(file, 'wx');
      try {
        await handle.writeFile(JSON.stringify(lock));
      } finally {
        await handle.close();
      }
      return {
        lock,
        async release() {
          await withLockMutation(directory, async () => {
            const current = await readFile(file, 'utf8').catch(() => '');
            if (parseDaemonLock(current)?.token === lock.token) await rm(file, { force: true });
          });
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const text = await readFile(file, 'utf8').catch(() => null);
    if (text === null) continue;
    const holder = parseDaemonLock(text);
    if (holder && (await lockHeld(holder, checks))) throw new DaemonRunningError(holder);
    // A lock is written right after it is created; give a starting daemon time to finish.
    if (!holder) {
      const age = await stat(file).then(
        (info) => checks.now() - info.mtimeMs,
        () => Infinity,
      );
      if (age < 10_000)
        throw new Error('Another Pitchcrew daemon is starting for this data folder.');
    }
    // Only remove the stale lock that was inspected, never one a new daemon just wrote.
    if ((await readFile(file, 'utf8').catch(() => null)) === text) await rm(file, { force: true });
  }
  throw new Error('Could not claim the data folder lock. Try again.');
}
