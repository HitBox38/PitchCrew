import type { BackgroundServiceInfo, BackgroundServiceStatus } from '@pitchcrew/core';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { backgroundServiceInfo } from '../src/background/info.ts';
import {
  acquireDaemonLock,
  DaemonRunningError,
  lockHeld,
  probeDaemon,
  type DaemonLock,
  type LockChecks,
} from '../src/background/lock.ts';
import { capLogFile, createRotatingLog } from '../src/background/log.ts';
import { resolveDaemonSettings } from '../src/background/settings.ts';
import { createDaemon } from '../src/server.ts';
import { cleanup, resources, setup } from './helpers/daemon.ts';

const folders: string[] = [];
async function folder() {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-test-'));
  folders.push(directory);
  return directory;
}
afterEach(async () => {
  await cleanup();
  for (const directory of folders.splice(0)) {
    if (!resolve(directory).startsWith(resolve(tmpdir(), 'pitchcrew-test-')))
      throw new Error('Refusing unsafe cleanup target.');
    await rm(directory, { recursive: true, force: true });
  }
});

const now = Date.parse('2030-01-01T12:00:00Z');
const checks = (overrides: Partial<LockChecks> = {}): LockChecks => ({
  isAlive: () => true,
  answers: async () => true,
  now: () => now,
  bootTime: () => now - 3_600_000,
  ...overrides,
});
const lock = (overrides: Partial<DaemonLock> = {}): DaemonLock => ({
  pid: 9999,
  port: 15371,
  service: true,
  startedAt: new Date(now - 60_000).toISOString(),
  bootedAt: new Date(now - 3_600_000).toISOString(),
  token: 'fixture',
  ...overrides,
});

describe('single daemon per data folder', () => {
  it('refuses a second daemon on the same data folder until the first closes', async () => {
    const { daemon, directory } = await setup(15371);
    await expect(
      createDaemon({ directory, port: 15372, seedSkills: false, dev: true }),
    ).rejects.toBeInstanceOf(DaemonRunningError);
    await expect(
      createDaemon({ directory, port: 15372, seedSkills: false, dev: true }),
    ).rejects.toThrow('already running for this data folder at http://127.0.0.1:15371');
    // The refused daemon never opened the board, so the first one keeps working.
    expect(daemon.service.board.list('role').length).toBeGreaterThan(0);
    await daemon.close();
    resources.pop();
    const next = await createDaemon({ directory, port: 15372, seedSkills: false, dev: true });
    resources.push({ daemon: next, directory });
    const recorded = JSON.parse(await readFile(join(directory, 'daemon.lock'), 'utf8'));
    expect(recorded).toMatchObject({ pid: process.pid, port: 15372, service: false });
  });

  it('removes its lock on close and reports whether the service started it', async () => {
    const directory = await folder();
    const daemon = await createDaemon({ directory, port: 15373, seedSkills: false, service: true });
    await new Promise<void>((resolve) => daemon.http.listen(15373, '127.0.0.1', resolve));
    expect(await probeDaemon(15373)).toEqual({ app: 'pitchcrew', service: true });
    await daemon.close();
    expect(await probeDaemon(15373)).toBeNull();
    await expect(readFile(join(directory, 'daemon.lock'))).rejects.toThrow();
  });

  it('replaces locks left by a crash, a restart or a reused process ID', async () => {
    const directory = await folder();
    const file = join(directory, 'daemon.lock');
    const stale: [Partial<DaemonLock>, Partial<LockChecks>][] = [
      [{}, { isAlive: () => false }],
      [{ bootedAt: new Date(now - 86_400_000).toISOString() }, {}],
      [{ startedAt: new Date(now - 3_600_000).toISOString() }, { answers: async () => false }],
    ];
    for (const [fields, overrides] of stale) {
      await writeFile(file, JSON.stringify(lock(fields)));
      const claimed = await acquireDaemonLock(
        directory,
        { port: 15374, service: false },
        checks(overrides),
      );
      expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({
        pid: process.pid,
        port: 15374,
      });
      await claimed.release();
    }
    await writeFile(file, JSON.stringify(lock()));
    await expect(
      acquireDaemonLock(directory, { port: 15374, service: false }, checks()),
    ).rejects.toThrow('process 9999, background service');
    // Releasing a lock never removes one another daemon owns.
    await writeFile(
      file,
      JSON.stringify(lock({ startedAt: new Date(now - 3_600_000).toISOString() })),
    );
    expect(
      await lockHeld(lock({ startedAt: new Date(now - 3_600_000).toISOString() }), checks()),
    ).toBe(true);
    await writeFile(file, '{');
    await expect(
      acquireDaemonLock(
        directory,
        { port: 15374, service: false },
        checks({ now: () => Date.now() }),
      ),
    ).rejects.toThrow('starting');
  });

  it('allows only one contender to reclaim a stale lock', async () => {
    const directory = await folder();
    for (let round = 0; round < 30; round++) {
      await writeFile(join(directory, 'daemon.lock'), JSON.stringify(lock({ pid: 2147483647 })));
      const results = await Promise.allSettled(
        Array.from({ length: 12 }, () =>
          acquireDaemonLock(directory, { port: 15374, service: false }),
        ),
      );
      const owners = results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
      );
      try {
        expect(owners).toHaveLength(1);
      } finally {
        await Promise.all(owners.map((owner) => owner.release()));
      }
    }
  });

  it('serves background service status only to a local UI session', async () => {
    const status: BackgroundServiceStatus = {
      platform: 'linux',
      installed: true,
      enabled: true,
      running: true,
      pid: 4242,
      directory: '',
      port: 15375,
      definition: '/fixture/pitchcrew.service',
      logFile: '/fixture/daemon.log',
      detail: 'systemd reports active running.',
    };
    const directory = await folder();
    const daemon = await createDaemon({
      directory,
      port: 15375,
      seedSkills: false,
      service: true,
      backgroundService: async () => ({ ...status, directory }),
    });
    resources.push({ daemon, directory });
    await new Promise<void>((resolve) => daemon.http.listen(15375, '127.0.0.1', resolve));
    const page = await fetch(daemon.url);
    const cookie = page.headers.get('set-cookie')!.split(';')[0];
    expect((await fetch(`${daemon.url}/api/background-service`)).status).toBe(403);
    const response = await fetch(`${daemon.url}/api/background-service`, {
      headers: { cookie, 'x-pitchcrew-client': 'ui' },
    });
    const info = (await response.json()) as BackgroundServiceInfo;
    expect(info).toMatchObject({
      startedByService: true,
      matches: true,
      customLocation: true,
      commands: { install: 'pnpm service install', uninstall: 'pnpm service uninstall' },
    });
    expect(info.status.pid).toBe(4242);
  });

  it('compares the installed service with the daemon answering the request', () => {
    const base: BackgroundServiceStatus = {
      platform: 'windows',
      installed: true,
      enabled: true,
      running: false,
      pid: null,
      directory: 'C:\\Users\\Fixture\\.pitchcrew',
      port: 4417,
      definition: 'Task Scheduler task "Pitchcrew"',
      logFile: null,
      detail: '',
    };
    const daemon = { directory: 'c:\\users\\fixture\\.pitchcrew', port: 4417, service: false };
    expect(backgroundServiceInfo(base, daemon, 'C:\\Users\\Fixture')).toMatchObject({
      matches: true,
      customLocation: false,
      startedByService: false,
    });
    expect(backgroundServiceInfo({ ...base, port: 4418 }, daemon).matches).toBe(false);
    expect(backgroundServiceInfo({ ...base, installed: false }, daemon).matches).toBe(false);
  });

  it('reads the data folder and port from service flags before the environment', () => {
    const home = resolve(tmpdir(), 'fixture-home');
    expect(resolveDaemonSettings({ PITCHCREW_PORT: '4500' }, [], home)).toEqual({
      directory: join(home, '.pitchcrew'),
      port: 4500,
    });
    expect(
      resolveDaemonSettings(
        { PITCHCREW_PORT: '4500' },
        ['--home', join(home, 'b'), '--port', '4501'],
        home,
      ),
    ).toEqual({ directory: join(home, 'b'), port: 4501 });
    expect(() => resolveDaemonSettings({ PITCHCREW_PORT: '80' }, [], home)).toThrow(
      'PITCHCREW_PORT',
    );
    expect(() => resolveDaemonSettings({ PITCHCREW_HOME: process.cwd() }, [], home)).toThrow(
      'outside the repository',
    );
  });
});

describe('service logs', () => {
  it('rotates at the size cap and keeps one older file', async () => {
    const directory = await folder();
    const file = join(directory, 'background-service', 'daemon.log');
    const log = createRotatingLog(file, 120);
    for (let i = 0; i < 7; i++) log.write(`fixture line ${i}`);
    const current = await readFile(file, 'utf8');
    const previous = await readFile(`${file}.1`, 'utf8');
    expect(Buffer.byteLength(current)).toBeLessThanOrEqual(120);
    expect(current).toContain('fixture line 6');
    expect(previous).toContain('fixture line 3');
    expect(previous).not.toContain('fixture line 0');
    const launchd = join(directory, 'launchd.log');
    await writeFile(launchd, 'x'.repeat(200));
    capLogFile(launchd, 100);
    expect(await readFile(launchd, 'utf8')).toBe('');
  });
});
