import { adapters } from '@pitchcrew/adapters';
import type { Role } from '@pitchcrew/core';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it, vi } from 'vitest';
import { RuntimeHeldError } from '../src/runtime-maintenance/availability.ts';
import { runtimeMaintenanceHost } from '../src/runtime-maintenance/index.ts';
import { RuntimeMaintenanceStore } from '../src/runtime-maintenance/store.ts';
import { createDaemon } from '../src/server.ts';
import { isolateRuntimes, reservePort, restoreRuntimes } from './helpers/daemon.ts';

const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-test-maintenance-startup-'));
  const reservation = await reservePort();
  // Own a harmless child: recovery only probes it with signal 0, never a real installer PID.
  const worker = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    stdio: 'ignore',
    windowsHide: true,
  });
  await once(worker, 'spawn');
  const stopWorker = async () => {
    if (worker.exitCode !== null || worker.signalCode !== null) return;
    const exited = once(worker, 'exit');
    worker.kill();
    await exited;
  };
  const store = new RuntimeMaintenanceStore(directory);
  store.state.running.codex = worker.pid!;
  store.state.updates = [
    {
      id: 'codex',
      status: 'available',
      installedVersion: '1.0.0',
      latestVersion: '1.1.0',
      checkedAt: '2026-11-01T00:00:00.000Z',
      lastSuccessAt: '2026-11-01T00:00:00.000Z',
      detail: 'Fictional update',
      installer: 'npm',
      canUpdate: true,
      manualCommand: 'fixture manual update',
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
  store.save();
  isolateRuntimes();
  const detect = vi.spyOn(adapters.codex, 'detect').mockResolvedValue({
    id: 'codex',
    available: true,
    version: '1.0.0',
    detail: 'Fictional usable installation',
  });
  const models = vi.spyOn(adapters.codex, 'listModels').mockResolvedValue([]);
  const forbidden = [
    ...Object.values(adapters).flatMap((adapter) => [
      vi.spyOn(adapter, 'run').mockRejectedValue(new Error('No runtime may run.')),
      vi.spyOn(adapter, 'chat').mockRejectedValue(new Error('No runtime may chat.')),
    ]),
    ...(['run', 'resolve', 'latest', 'authenticate'] as const).map((method) =>
      vi.spyOn(runtimeMaintenanceHost, method).mockRejectedValue(new Error('No maintenance.')),
    ),
  ];
  let daemon: Awaited<ReturnType<typeof createDaemon>> | undefined;
  return {
    directory,
    store,
    worker,
    stopWorker,
    detect,
    models,
    forbidden,
    start: async (runtimeUpdateChecks = false) =>
      (daemon = await createDaemon({
        directory,
        port: reservation.port,
        ui: false,
        seedSkills: false,
        runtimeUpdateChecks,
      })),
    dispose: async () => {
      await stopWorker();
      await daemon?.close();
      reservation.release();
      vi.restoreAllMocks();
      restoreRuntimes();
      if (!resolve(directory).startsWith(resolve(tmpdir(), 'pitchcrew-test-maintenance-startup-')))
        throw new Error('Refusing unsafe cleanup target.');
      await rm(directory, { recursive: true, force: true });
    },
  };
};

it.each([false, true])(
  'seeds a fresh production crew with a surviving installer (update checks: %s)',
  async (runtimeUpdateChecks) => {
    const test = await fixture();
    try {
      const daemon = await test.start(runtimeUpdateChecks);
      const manager = daemon.service.runtimeMaintenance;
      const snapshot = await daemon.service.snapshot();
      expect(snapshot.runtimes.map((runtime) => runtime.id)).toEqual(
        Object.keys(adapters).filter((id) => id !== 'demo'),
      );
      expect(snapshot.runtimes.find((runtime) => runtime.id === 'codex')).toMatchObject({
        id: 'codex',
        available: false,
        version: '',
        detail: expect.stringMatching(/set up|updat/i),
        modelSource: 'fallback',
        applicationIsolation: adapters.codex.applicationIsolation === true,
        customReasoning: adapters.codex.customReasoning === true,
      });
      expect(snapshot.roles).toHaveLength(8);
      expect(snapshot.roles.every((role) => !role.enabled)).toBe(true);
      for (const role of snapshot.roles)
        expect(
          await readFile(join(test.directory, 'roles', role.id, 'AGENTS.md'), 'utf8'),
        ).toContain(role.instructions);
      expect(manager.isUpdating('codex')).toBe(true);
      expect(manager.held({ runtime: 'codex', model: '' })).toBe(true);
      expect(manager.current().updates[0]).toMatchObject({
        canUpdate: false,
        operation: { stage: 'updating', finishedAt: null },
      });
      expect(new RuntimeMaintenanceStore(test.directory).state.running.codex).toBe(test.worker.pid);
      const action = vi.fn(async () => true);
      await expect(manager.guard({ runtime: 'codex', model: '' }, action)).rejects.toBeInstanceOf(
        RuntimeHeldError,
      );
      await expect(daemon.service.runtimeModels('codex')).rejects.toBeInstanceOf(RuntimeHeldError);
      expect(() => manager.startUpdate('codex')).toThrow();
      expect(action).not.toHaveBeenCalled();
      const health = await daemon.app.inject({
        url: '/api/health',
        headers: { host: new URL(daemon.url).host },
      });
      expect(health.statusCode).toBe(200);
      await daemon.service.detect();
      expect(test.detect).not.toHaveBeenCalled();
      expect(test.models).not.toHaveBeenCalled();
      for (const action of test.forbidden) expect(action).not.toHaveBeenCalled();
      expect(daemon.service.board.list('run')).toEqual([]);
      expect(() => process.kill(test.worker.pid!, 0)).not.toThrow();
    } finally {
      await test.dispose();
    }
  },
);

it('rechecks after the surviving worker exits without rerunning it or changing seeded roles', async () => {
  const test = await fixture();
  try {
    const daemon = await test.start();
    const roles = daemon.service.board.list<Role>('role');
    await test.stopWorker();
    await daemon.service.runtimeMaintenance.recover();
    expect(test.detect).toHaveBeenCalledTimes(1);
    expect(
      (await daemon.service.snapshot()).runtimes.find((runtime) => runtime.id === 'codex'),
    ).toMatchObject({ available: true, version: '1.0.0' });
    expect(daemon.service.runtimeMaintenance.isUpdating('codex')).toBe(false);
    expect(daemon.service.runtimeMaintenance.current().updates[0]).toMatchObject({
      canUpdate: false,
      operation: { stage: 'interrupted', finishedAt: expect.any(String) },
    });
    expect(new RuntimeMaintenanceStore(test.directory).state.running).toEqual({});
    expect(daemon.service.board.list('role')).toEqual(roles);
    for (const action of test.forbidden) expect(action).not.toHaveBeenCalled();
  } finally {
    await test.dispose();
  }
});

it('recovers an already exited worker before choosing the initial crew runtime', async () => {
  const test = await fixture();
  try {
    await test.stopWorker();
    const daemon = await test.start();
    expect(test.detect).toHaveBeenCalledTimes(1);
    expect(test.models).toHaveBeenCalledTimes(1);
    expect(
      (await daemon.service.snapshot()).runtimes.find((runtime) => runtime.id === 'codex'),
    ).toMatchObject({ available: true, version: '1.0.0', modelSource: 'runtime' });
    expect(daemon.service.board.list<Role>('role')).toHaveLength(8);
    expect(daemon.service.board.list<Role>('role').every((role) => role.runtime === 'codex')).toBe(
      true,
    );
    expect(daemon.service.runtimeMaintenance.current().updates[0].operation?.stage).toBe(
      'interrupted',
    );
    for (const action of test.forbidden) expect(action).not.toHaveBeenCalled();
  } finally {
    await test.dispose();
  }
});

it('detects normally without saved maintenance and retains an existing entry during a later hold', async () => {
  const test = await fixture();
  try {
    const saved = structuredClone(test.store.state);
    test.store.state.running = {};
    test.store.state.updates = [];
    test.store.save();
    const daemon = await test.start();
    expect(test.detect).toHaveBeenCalledTimes(1);
    expect(test.models).toHaveBeenCalledTimes(1);
    const previous = (await daemon.service.snapshot()).runtimes.find(
      (runtime) => runtime.id === 'codex',
    );
    expect(previous).toMatchObject({ available: true, modelSource: 'runtime' });
    expect(daemon.service.board.list<Role>('role')).toHaveLength(8);
    const manager = daemon.service.runtimeMaintenance;
    manager.store.state.running = saved.running;
    manager.store.state.updates = saved.updates;
    await daemon.service.detect();
    expect(
      (await daemon.service.snapshot()).runtimes.find((runtime) => runtime.id === 'codex'),
    ).toEqual(previous);
    expect(test.detect).toHaveBeenCalledTimes(1);
    expect(test.models).toHaveBeenCalledTimes(1);
    expect(manager.isUpdating('codex')).toBe(true);
    expect(manager.current().updates[0].canUpdate).toBe(false);
    for (const action of test.forbidden) expect(action).not.toHaveBeenCalled();
  } finally {
    await test.dispose();
  }
});
