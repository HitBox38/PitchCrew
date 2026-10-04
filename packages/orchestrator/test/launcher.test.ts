import { describe, expect, it, vi } from 'vitest';
import {
  planDaemon,
  prepareDaemon,
  stopsOnExit,
  type DaemonHealth,
  type LauncherDeps,
} from '../src/background/launcher.ts';

const settings = { directory: 'C:\\Users\\Fixture User\\.pitchcrew', port: 4417 };
const installed = { installed: true, directory: 'c:\\users\\fixture user\\.pitchcrew', port: 4417 };

describe('desktop launcher ownership', () => {
  it('reuses running daemons, starts a matching service and only owns what it spawns', () => {
    const service: DaemonHealth = { app: 'pitchcrew', service: true };
    const other: DaemonHealth = { app: 'pitchcrew', service: false };
    const cases = [
      [
        planDaemon(service, null, settings, 'windows'),
        { action: 'reuse', owner: 'service' },
        false,
      ],
      [
        planDaemon(other, installed, settings, 'windows'),
        { action: 'reuse', owner: 'other' },
        false,
      ],
      [planDaemon(null, installed, settings, 'windows'), { action: 'start-service' }, false],
      [
        planDaemon(null, { ...installed, port: 4418 }, settings, 'windows'),
        { action: 'spawn' },
        true,
      ],
      [planDaemon(null, installed, settings, 'linux'), { action: 'spawn' }, true],
      [
        planDaemon(null, { ...installed, installed: false }, settings, 'windows'),
        { action: 'spawn' },
        true,
      ],
      [planDaemon(null, null, settings, null), { action: 'spawn' }, true],
    ] as const;
    for (const [plan, expected, owned] of cases) {
      expect(plan).toEqual(expected);
      expect(stopsOnExit(plan)).toBe(owned);
    }
  });

  function deps(overrides: Partial<LauncherDeps>, answers: (DaemonHealth | null)[]): LauncherDeps {
    const health = vi.fn(async () => (answers.length > 1 ? answers.shift()! : answers[0]));
    return {
      settings,
      platform: 'windows',
      health,
      serviceStatus: async () => installed,
      startService: vi.fn(async () => {}),
      spawnDaemon: vi.fn(() => ({ kill: vi.fn() })),
      sleep: async () => {},
      log: () => {},
      attempts: 5,
      ...overrides,
    };
  }

  it('never spawns or stops a daemon when the service owns it', async () => {
    const running = deps({}, [{ app: 'pitchcrew', service: true }]);
    const reused = await prepareDaemon(running);
    expect(reused).toEqual({ plan: { action: 'reuse', owner: 'service' }, child: null });
    expect(running.startService).not.toHaveBeenCalled();
    expect(running.spawnDaemon).not.toHaveBeenCalled();

    const stopped = deps({}, [null, null, { app: 'pitchcrew', service: true }]);
    const started = await prepareDaemon(stopped);
    expect(started).toEqual({ plan: { action: 'start-service' }, child: null });
    expect(stopsOnExit(started.plan)).toBe(false);
    expect(stopped.startService).toHaveBeenCalledOnce();
    expect(stopped.spawnDaemon).not.toHaveBeenCalled();
  });

  it('reports a service that does not start instead of spawning a competing daemon', async () => {
    const broken = deps({}, [null]);
    await expect(prepareDaemon(broken)).rejects.toThrow('pnpm service logs');
    expect(broken.spawnDaemon).not.toHaveBeenCalled();
  });

  it('spawns its own daemon without a matching service and stops it if it never answers', async () => {
    const kill = vi.fn();
    const spawned = deps({ serviceStatus: async () => null, spawnDaemon: () => ({ kill }) }, [
      null,
      { app: 'pitchcrew', service: false },
    ]);
    const result = await prepareDaemon(spawned);
    expect(result.plan).toEqual({ action: 'spawn' });
    expect(stopsOnExit(result.plan)).toBe(true);
    expect(result.child).toEqual({ kill });
    const failing = deps(
      {
        serviceStatus: async () => Promise.reject(new Error('schtasks failed')),
        spawnDaemon: () => ({ kill }),
      },
      [null],
    );
    await expect(prepareDaemon(failing)).rejects.toThrow('did not become ready');
    expect(kill).toHaveBeenCalledOnce();
  });
});
