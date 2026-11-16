import { adapters, type RuntimeInstallation } from '@pitchcrew/adapters';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { RuntimeMaintenance, runtimeMaintenanceHost } from '../src/runtime-maintenance/index.ts';
import { RuntimeMaintenanceStore } from '../src/runtime-maintenance/store.ts';
import { createDaemon } from '../src/server.ts';
import { isolateRuntimes, reservePort, restoreRuntimes } from './helpers/daemon.ts';
import {
  startupInstallation,
  startupRuntimes,
  startupUpdates,
} from './fixtures/startup/maintenance.ts';

const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-test-startup-maintenance-'));
  const reservation = await reservePort();
  isolateRuntimes();
  const store = new RuntimeMaintenanceStore(directory);
  store.state.updates = startupUpdates();
  store.state.identities = Object.fromEntries(
    startupRuntimes.map((id) => [id, startupInstallation(id).identity]),
  );
  store.save();
  const gates = startupRuntimes.map(() => {
    let finish!: (value: RuntimeInstallation | null) => void;
    const promise = new Promise<RuntimeInstallation | null>((resolve) => {
      finish = resolve;
    });
    return { promise, finish };
  });
  const resolve = vi.spyOn(runtimeMaintenanceHost, 'resolve').mockImplementation((id) =>
    gates[startupRuntimes.findIndex((runtime) => runtime === id)].promise.then((result) => {
      if (id === 'opencode') throw new Error('Fictional unavailable installer metadata.');
      return result;
    }),
  );
  const run = vi
    .spyOn(runtimeMaintenanceHost, 'run')
    .mockRejectedValue(new Error('No installer may run.'));
  const launches = Object.values(adapters).flatMap((adapter) => [
    vi.spyOn(adapter, 'run').mockRejectedValue(new Error('No runtime may run.')),
    vi.spyOn(adapter, 'chat').mockRejectedValue(new Error('No runtime may chat.')),
  ]);
  let creation: ReturnType<typeof createDaemon> | undefined;
  return {
    directory,
    reservation,
    store,
    gates,
    resolve,
    run,
    launches,
    start: () =>
      (creation = createDaemon({
        directory,
        port: reservation.port,
        ui: false,
        seedSkills: false,
        runtimeUpdateChecks: true,
      })),
    dispose: async () => {
      for (const gate of gates) gate.finish(null);
      await creation?.then(
        (daemon) => daemon.close(),
        () => {},
      );
      reservation.release();
      vi.restoreAllMocks();
      restoreRuntimes();
      await rm(directory, { recursive: true, force: true });
    },
  };
};

it('overlaps independent installation recovery and waits for every result before HTTP readiness', async () => {
  const test = await fixture();
  const creation = test.start();
  let ready = false;
  void creation.then(
    () => {
      ready = true;
    },
    () => {},
  );
  try {
    // Deferred results make this an ordering contract, independent of machine speed.
    await vi.waitFor(() => expect(test.resolve).toHaveBeenCalledTimes(3), { timeout: 1000 });
    expect(ready).toBe(false);
    test.gates[0].finish(startupInstallation('codex'));
    test.gates[1].finish({ ...startupInstallation('claude-code'), identity: 'changed' });
    await vi.waitFor(() =>
      expect(
        test.resolve.mock.settledResults.slice(0, 2).every((result) => result.type === 'fulfilled'),
      ).toBe(true),
    );
    expect(ready).toBe(false);
    test.gates[2].finish(null);
    const daemon = await creation;
    const health = await daemon.app.inject({
      url: '/api/health',
      headers: { host: `127.0.0.1:${test.reservation.port}` },
    });
    expect(health.statusCode).toBe(200);
    expect(
      daemon.service.runtimeMaintenance
        .current()
        .updates.map(({ id, canUpdate }) => ({ id, canUpdate })),
    ).toEqual([
      { id: 'codex', canUpdate: true },
      { id: 'claude-code', canUpdate: false },
      { id: 'opencode', canUpdate: false },
    ]);
    expect(daemon.service.runtimeMaintenance.current().updates[1].detail).toContain(
      'installation changed',
    );
    expect(daemon.service.runtimeMaintenance.current().updates[2].detail).toContain(
      'Recheck this runtime',
    );
    const saved = new RuntimeMaintenanceStore(test.directory);
    expect(saved.state.updates.slice(0, 3).map((update) => update.canUpdate)).toEqual([
      true,
      false,
      false,
    ]);
    expect(test.run).not.toHaveBeenCalled();
    for (const launch of test.launches) expect(launch).not.toHaveBeenCalled();
    expect(daemon.service.board.list('run')).toEqual([]);
  } finally {
    await test.dispose();
  }
});

it('drains pending ownership lookups before rejecting startup after a persistence failure', async () => {
  const test = await fixture();
  // Ownership validation succeeds, but the private metadata cannot be atomically saved.
  await mkdir(join(test.directory, 'runtime-maintenance.json.tmp'));
  const creation = test.start();
  let settled = false;
  void creation.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  try {
    await vi.waitFor(() => expect(test.resolve).toHaveBeenCalledTimes(3), { timeout: 1000 });
    test.gates[0].finish(startupInstallation('codex'));
    await vi.waitFor(() => expect(test.resolve.mock.settledResults[0].type).toBe('fulfilled'));
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);
    test.gates[1].finish(null);
    test.gates[2].finish(null);
    const failure = await creation.catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toHaveLength(3);
    for (const error of (failure as AggregateError).errors) expect(error).toBeInstanceOf(Error);
    await rm(join(test.directory, 'runtime-maintenance.json.tmp'), { recursive: true });
    // Failed startup releases its board and data-folder lock for a normal retry.
    const retry = await test.start();
    expect(retry.service.board.list('role')).toHaveLength(8);
  } finally {
    await test.dispose();
  }
});

it('keeps a surviving maintenance worker held instead of restoring its update controls', async () => {
  const test = await fixture();
  for (const gate of test.gates) gate.finish(null);
  try {
    const daemon = await test.start();
    const manager = daemon.service.runtimeMaintenance;
    manager.store.state.updates = [
      {
        ...startupUpdates()[0],
        operation: {
          id: crypto.randomUUID(),
          stage: 'updating',
          startedAt: '2026-11-01T00:00:00.000Z',
          finishedAt: null,
          detail: 'Fictional surviving worker',
          output: '',
        },
      },
    ];
    manager.store.state.running.codex = process.pid;
    manager.store.save();
    const restored = new RuntimeMaintenance(test.directory, () => manager.context());
    test.resolve.mockClear();
    await restored.recover();
    expect(test.resolve).not.toHaveBeenCalled();
    expect(restored.isUpdating('codex')).toBe(true);
    expect(restored.current().updates[0].canUpdate).toBe(false);
    expect(restored.current().updates[0].operation?.finishedAt).toBeNull();
    expect(test.run).not.toHaveBeenCalled();
  } finally {
    await test.dispose();
  }
});
