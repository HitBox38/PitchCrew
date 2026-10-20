import { afterEach, expect, it, vi } from 'vitest';
import { adapters, type RuntimeInstallation } from '@pitchcrew/adapters';
import type { RuntimeAuthentication, RuntimeMaintenanceState, Snapshot } from '@pitchcrew/core';
import { RuntimeHeldError } from '../src/runtime-maintenance/availability.ts';
import { RuntimeMaintenance } from '../src/runtime-maintenance/index.ts';
import { cleanup, setup } from './helpers/daemon.ts';
const fixture = async () => {
  const test = await setup(14991);
  const manager = test.daemon.service.runtimeMaintenance;
  manager.enabled = true;
  manager.authenticationEnabled = true;
  manager.context().runtimes = [
    {
      id: 'codex',
      available: true,
      version: '1.0.0',
      detail: 'Fixture runtime',
      models: [],
      modelSource: 'none',
      modelDetail: '',
    },
  ];
  vi.spyOn(manager.host, 'detect').mockImplementation(async () => manager.context().runtimes);
  vi.spyOn(manager.host, 'resolve').mockResolvedValue(installation);
  vi.spyOn(manager.host, 'latest').mockResolvedValue('1.1.0');
  vi.spyOn(manager.host, 'authenticate').mockImplementation(async () => ({
    status: 'unknown',
    checkedAt: new Date().toISOString(),
    detail: 'Fixture authentication',
    instructions: 'Fixture setup',
  }));
  vi.spyOn(adapters.codex, 'detect').mockResolvedValue({
    id: 'codex',
    available: true,
    version: '1.0.0',
    detail: 'Fixture runtime',
  });
  return { ...test, manager };
};

afterEach(cleanup);
const installation: RuntimeInstallation = {
  executable: '/fixture/codex',
  realPath: '/fixture/codex',
  identity: 'fixture-codex-npm',
  installer: 'npm',
  command: {
    file: '/fixture/node',
    args: ['fixture-npm.js', 'install', '--global', '--prefix', '/fixture', '@openai/codex@latest'],
  },
  manualCommand: 'fixture manual update',
  detail: 'Fixture installer',
};

it('requires a local UI session and rejects renderer-supplied installer arguments', async () => {
  const { daemon, request } = await fixture();
  const denied = await fetch(`${daemon.url}/api/runtimes/codex/update`, { method: 'POST' });
  expect(denied.status).toBe(403);
  const custom = await request('/runtimes/codex/update', 'POST', { command: 'unexpected' });
  expect(custom.response.status).toBe(400);
});

it('shares daily checks across clients and persists the preference without board events', async () => {
  const { request, manager, daemon } = await fixture();
  const count = daemon.service.board.events().length;
  await Promise.all([manager.check(true), manager.check(true)]);
  await manager.check(true);
  expect(manager.host.latest).toHaveBeenCalledTimes(1);
  expect(
    (await request('/runtimes/updates/preferences', 'PUT', { automatic: false })).response.status,
  ).toBe(200);
  const restored = new RuntimeMaintenance(daemon.service.directory, () => manager.context());
  expect(restored.current().automatic).toBe(false);
  expect(daemon.service.board.events()).toHaveLength(count);
});

it('reserves before starting, deduplicates clicks and blocks only that runtime until verification', async () => {
  const { manager, request } = await fixture();
  let finish!: (value: { code: number; stdout: string; stderr: string }) => void;
  const run = vi.spyOn(manager.host, 'run').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await manager.check();
  vi.mocked(adapters.codex.detect)
    .mockResolvedValueOnce({
      id: 'codex',
      available: true,
      version: '1.0.0',
      detail: 'Fixture runtime',
    })
    .mockResolvedValue({
      id: 'codex',
      available: true,
      version: '1.1.0',
      detail: 'Fixture runtime',
    });
  const before = await manager.context().snapshot();
  const revision = await (
    await request<{ result?: unknown }>('/snapshot')
  ).response.headers.get('etag');
  expect((await request('/runtimes/codex/update', 'POST', {})).response.status).toBe(202);
  expect((await request('/runtimes/codex/update', 'POST', {})).response.status).toBe(202);
  await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  await expect(
    manager.guard({ runtime: 'codex', model: '' }, async () => {}),
  ).rejects.toBeInstanceOf(RuntimeHeldError);
  await expect(
    manager.guard({ runtime: 'demo', model: '' }, async () => 'other-runtime'),
  ).resolves.toBe('other-runtime');
  expect(manager.current().updates[0].operation?.stage).toBe('updating');
  const conditional = await request<Snapshot>(
    '/snapshot',
    'GET',
    undefined,
    revision ? { 'if-none-match': revision } : {},
  );
  expect(conditional.response.status).toBe(200);
  expect(conditional.result.runtimeMaintenance?.updates[0].operation?.stage).toBe('updating');
  finish({ code: 0, stdout: '', stderr: '' });
  await manager.active.get('codex');
  expect(manager.current().updates[0].operation?.stage).toBe('succeeded');
  expect(manager.context().runtimes[0].version).toBe('1.1.0');
  expect(before.runtimeMaintenance?.updates[0].status).toBe('available');
});

it('refuses stale installation ownership and refuses a false-success installer', async () => {
  const { manager } = await fixture();
  const run = vi.spyOn(manager.host, 'run').mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  await manager.check();
  vi.mocked(manager.host.resolve).mockResolvedValue({ ...installation, identity: 'changed' });
  manager.startUpdate('codex');
  await manager.active.get('codex');
  expect(run).not.toHaveBeenCalled();
  expect(manager.current().updates[0].operation?.stage).toBe('failed');
  vi.mocked(manager.host.resolve).mockResolvedValue(installation);
  vi.mocked(adapters.codex.detect).mockResolvedValue({
    id: 'codex',
    available: true,
    version: '1.0.0',
    detail: 'Old but usable',
  });
  manager.context().runtimes[0].version = '1.0.0';
  await manager.check();
  manager.startUpdate('codex');
  await manager.active.get('codex');
  expect(manager.current().updates[0].operation?.stage).toBe('failed');
  await expect(manager.guard({ runtime: 'codex', model: '' }, async () => true)).resolves.toBe(
    true,
  );
});

it('holds known missing authentication by configuration, refreshes on retry and expires cache', async () => {
  const { manager } = await fixture();
  let now = Date.now();
  vi.spyOn(manager.host, 'now').mockImplementation(() => now);
  const missing: RuntimeAuthentication = {
    status: 'missing',
    checkedAt: new Date(now).toISOString(),
    detail: 'Fixture sign-in needed',
    instructions: 'Fixture setup',
  };
  vi.mocked(manager.host.authenticate).mockResolvedValue(missing);
  await expect(manager.guard({ runtime: 'codex', model: 'one' }, async () => {})).rejects.toThrow(
    'Fixture sign-in',
  );
  expect(manager.held({ runtime: 'codex', model: 'one' })).toBe(true);
  expect(manager.held({ runtime: 'codex', model: 'two' })).toBe(false);
  vi.mocked(manager.host.authenticate).mockResolvedValue({ ...missing, status: 'unknown' });
  await manager.refreshOnRetry({ runtime: 'codex', model: 'one' });
  expect(manager.held({ runtime: 'codex', model: 'one' })).toBe(false);
  const count = vi.mocked(manager.host.authenticate).mock.calls.length;
  now += 301_000;
  await manager.authenticate({ runtime: 'codex', model: 'one' });
  expect(manager.host.authenticate).toHaveBeenCalledTimes(count + 1);
});

it('recovers interrupted operations without replaying their installer', async () => {
  const { manager, request } = await fixture();
  await manager.check();
  const update = manager.store.state.updates[0];
  update.operation = {
    id: crypto.randomUUID(),
    stage: 'updating',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    detail: 'Fixture operation',
    output: '',
  };
  manager.store.save();
  const restored = new RuntimeMaintenance(manager.context().directory, () => manager.context());
  const run = vi.spyOn(restored.host, 'run');
  await restored.recover();
  expect(restored.current().updates[0].operation?.stage).toBe('interrupted');
  expect(run).not.toHaveBeenCalled();
  expect((await request<RuntimeMaintenanceState>('/runtimes/maintenance')).response.status).toBe(
    200,
  );
});

it('never downgrades a runtime upgraded externally after the notice was shown', async () => {
  const { manager } = await fixture();
  await manager.check();
  vi.mocked(adapters.codex.detect).mockResolvedValue({
    id: 'codex',
    available: true,
    version: '1.2.0',
    detail: 'External newer version',
  });
  const run = vi.spyOn(manager.host, 'run');
  manager.startUpdate('codex');
  await manager.active.get('codex');
  expect(run).not.toHaveBeenCalled();
  expect(manager.current().updates[0].installedVersion).toBe('1.2.0');
});

it('offers update remediation for an installed version below the compatibility minimum', async () => {
  const { manager } = await fixture();
  manager.context().runtimes[0] = {
    ...manager.context().runtimes[0],
    id: 'pi',
    version: '0.9.0',
    available: false,
  };
  vi.mocked(manager.host.latest).mockResolvedValue('1.1.0');
  await manager.check();
  expect(manager.current().updates[0]).toMatchObject({
    id: 'pi',
    status: 'available',
    canUpdate: true,
  });
  vi.mocked(manager.host.latest).mockResolvedValue('0.10.0');
  await manager.check();
  expect(manager.current().updates[0].canUpdate).toBe(false);
});

it('rejects a runtime configuration changed while authentication is being checked', async () => {
  const { manager } = await fixture();
  const launch = vi.fn(async () => true);
  await expect(
    manager.guard({ runtime: 'codex', model: 'before' }, launch, false, () => ({
      runtime: 'codex',
      model: 'after',
    })),
  ).rejects.toThrow('settings changed');
  expect(launch).not.toHaveBeenCalled();
});
