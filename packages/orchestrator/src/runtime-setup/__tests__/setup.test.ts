import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { runtimeExecutable } from '@pitchcrew/adapters';
import type { RuntimeId, RuntimeInfo } from '@pitchcrew/core';
import type { CrewContext } from '../../crew/types.ts';
import { RuntimeSetupManager } from '../index.ts';

const folders: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const folder of folders.splice(0)) {
    if (
      dirname(resolve(folder)) !== resolve(tmpdir()) ||
      !basename(folder).startsWith('pitchcrew-runtime-setup-')
    )
      throw new Error('Unsafe fixture cleanup path.');
    await rm(folder, { recursive: true, force: true });
  }
});

it('contains installer-output storage failures and releases the runtime without adopting a path', async () => {
  const { manager, active } = await fixture();
  vi.spyOn(manager.host, 'run').mockImplementation(async (_command, options) => {
    vi.spyOn(manager.store, 'save').mockImplementation(() => {
      throw new Error('Fixture disk full');
    });
    expect(() => options.onOutput?.('Fictional installer progress')).not.toThrow();
    expect(options.signal?.aborted).toBe(true);
    return { code: 1, stdout: '', stderr: '' };
  });
  const starting = manager.install('codex');
  const operation = active.get('codex')!;
  await starting;
  await expect(operation).resolves.toBeUndefined();
  expect(active.size).toBe(0);
  expect(manager.store.state.paths.codex).toBeUndefined();
  expect(manager.store.state.operations.codex).toMatchObject({ stage: 'failed' });
  expect(manager.store.state.operations.codex?.detail).toContain('storage is unavailable');
  expect(manager.store.state.operations.codex?.finishedAt).toBeTruthy();
});
const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-runtime-setup-'));
  folders.push(directory);
  const active = new Map<RuntimeId, Promise<void>>();
  const session = { id: 'fixture-session', runtime: 'codex', invalid: false };
  const context = {
    directory,
    closing: false,
    initializing: true,
    modelCatalogs: new Map(),
    runtimes: [
      {
        id: 'codex',
        available: false,
        version: '',
        detail: '',
        models: [],
        modelSource: 'none',
        modelDetail: '',
      },
    ] as RuntimeInfo[],
    board: {
      list: (kind: string) => (kind === 'conversation_session' ? [session] : []),
      record: vi.fn(),
    },
    runtimeMaintenance: {
      enabled: true,
      active,
      controller: new AbortController(),
      installations: new Map(),
      busy: vi.fn(() => [] as string[]),
      isUpdating: (id: RuntimeId) => active.has(id),
      clearAuthentication: vi.fn(),
      metadata: async (_id: RuntimeId, action: () => Promise<unknown>) => action(),
      store: { state: { updates: [], identities: {} }, save: vi.fn() },
    },
    drainTasks: vi.fn(),
  } as unknown as CrewContext;
  const detect = vi.fn(async (id: RuntimeId) => ({
    id,
    available: true,
    version: '1.2.0',
    detail: 'Fictional fixture runtime',
  }));
  const manager = new RuntimeSetupManager(directory, () => context, {
    detect,
    executable: async (command) =>
      runtimeExecutable(command) === command ? null : runtimeExecutable(command),
    npm: async () => join(directory, 'fixture-npm-cli.js'),
    latest: async () => '1.2.0',
    installed: async () => process.execPath,
    run: vi.fn(async () => ({ code: 0, stdout: '', stderr: '' })),
  });
  context.runtimeSetup = manager;
  return { manager, context, directory, active, detect };
};

it('validates an executable before adopting it and invalidates native sessions and metadata', async () => {
  const { manager, context, active } = await fixture();
  const request = manager.configure('codex', process.execPath);
  expect(active.has('codex')).toBe(true);
  await expect(request).resolves.toMatchObject({
    configuredPath: process.execPath,
    source: 'custom',
  });
  expect(manager.withExecutables(() => runtimeExecutable('codex'))).toBe(process.execPath);
  expect(context.board.record).toHaveBeenCalledWith(
    'conversation_session',
    expect.objectContaining({ invalid: true }),
    'user',
    expect.any(String),
  );
  expect(context.runtimeMaintenance.clearAuthentication).toHaveBeenCalledWith('codex');
  expect(active.size).toBe(0);
  expect((await manager.configure('codex', null)).configuredPath).toBeNull();
});

it('preserves the previous path when validation fails and rejects changes while work is busy', async () => {
  const { manager, context, detect } = await fixture();
  await manager.configure('codex', process.execPath);
  await expect(manager.configure('codex', 'relative/path')).rejects.toThrow('absolute');
  detect.mockResolvedValueOnce({
    id: 'codex',
    available: false,
    version: '',
    detail: 'Fixture invalid executable',
  });
  await expect(manager.configure('codex', process.execPath)).rejects.toThrow(
    'previous configuration was kept',
  );
  expect(manager.store.state.paths.codex?.path).toBe(process.execPath);
  vi.mocked(context.runtimeMaintenance.busy).mockReturnValue(['Writer is running.']);
  expect(() => manager.configure('codex', null)).toThrow('become idle');
});

it('installs a pinned official release in the local data prefix and adopts only after verification', async () => {
  const { manager, context, directory } = await fixture();
  await expect(manager.info('codex')).resolves.toMatchObject({
    canInstall: true,
    configuredPath: null,
  });
  const started = await manager.install('codex');
  expect(started.operation?.finishedAt).toBeNull();
  await context.runtimeMaintenance.active.get('codex');
  expect(manager.host.run).toHaveBeenCalledWith(
    expect.objectContaining({
      args: [
        expect.any(String),
        'install',
        '--global',
        '--prefix',
        join(directory, 'runtimes', 'codex'),
        '--no-audit',
        '--no-fund',
        '--registry',
        'https://registry.npmjs.org',
        '@openai/codex@1.2.0',
      ],
    }),
    expect.objectContaining({
      timeout: 600000,
      lockKey: `npm:${join(directory, 'runtimes', 'codex')}`,
    }),
  );
  expect(await manager.info('codex')).toMatchObject({
    source: 'managed',
    configuredPath: process.execPath,
    operation: { stage: 'succeeded' },
  });
});

it('retains failure output without adopting an unverified installation', async () => {
  const { manager, context, detect } = await fixture();
  detect.mockResolvedValueOnce({
    id: 'codex',
    available: false,
    version: '',
    detail: 'Fixture missing runtime',
  });
  await manager.install('codex');
  await context.runtimeMaintenance.active.get('codex');
  expect(manager.store.state.paths.codex).toBeUndefined();
  expect((await manager.info('codex')).operation).toMatchObject({
    stage: 'failed',
    detail: expect.stringContaining('not adopted'),
  });
});

it('reports uncertain status without denying adoption when the success-status save fails', async () => {
  const { manager, context, directory } = await fixture();
  const save = manager.store.save.bind(manager.store);
  let failed = false;
  vi.spyOn(manager.store, 'save').mockImplementation(() => {
    const operation = manager.store.state.operations.codex;
    if (operation?.stage === 'succeeded' && !failed) {
      failed = true;
      throw new Error('Fixture transient status write failure');
    }
    save();
  });
  await manager.install('codex');
  await context.runtimeMaintenance.active.get('codex');
  expect(failed).toBe(true);
  expect(manager.store.state.paths.codex?.path).toBe(process.execPath);
  expect(context.runtimes[0].available).toBe(true);
  expect((await manager.info('codex')).operation).toMatchObject({
    stage: 'failed',
    detail: expect.stringContaining('Recheck the selected executable'),
  });
  const reopened = new RuntimeSetupManager(directory, () => context);
  expect(reopened.store.state.paths.codex?.path).toBe(process.execPath);
});

it('cancels the owned installer before releasing its runtime reservation', async () => {
  const { manager, context } = await fixture();
  vi.mocked(manager.host.run).mockImplementation(
    async (_command, options) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new Error('Fixture cancelled')), {
          once: true,
        });
      }),
  );
  const started = await manager.install('codex');
  await vi.waitFor(() => expect(manager.host.run).toHaveBeenCalled());
  await expect(manager.cancel('codex', started.operation!.id)).resolves.toMatchObject({
    configuredPath: null,
    operation: { stage: 'cancelled' },
  });
  expect(context.runtimeMaintenance.active.size).toBe(0);
});

it('keeps the active selection when saving the new path fails after session invalidation', async () => {
  const { manager, context } = await fixture();
  const save = vi.spyOn(manager.store, 'save').mockImplementation(() => {
    throw new Error('Fixture disk unavailable');
  });
  await expect(manager.configure('codex', process.execPath)).rejects.toThrow(
    'Fixture disk unavailable',
  );
  expect(manager.store.state.paths.codex).toBeUndefined();
  expect(context.board.record).toHaveBeenCalled();
  expect(context.runtimeMaintenance.active.size).toBe(0);
  save.mockRestore();
});

it.each(['maintenance', 'sessions'])(
  'keeps executable selection and health when %s invalidation fails',
  async (failure) => {
    const { manager, context, active } = await fixture();
    await manager.configure('codex', process.execPath);
    const original = structuredClone(context.runtimes);
    if (failure === 'maintenance')
      vi.spyOn(context.runtimeMaintenance.store, 'save').mockImplementation(() => {
        throw new Error('Fixture storage unavailable');
      });
    else
      vi.spyOn(context.board, 'record').mockImplementation(() => {
        throw new Error('Fixture session write failed');
      });
    await expect(manager.configure('codex', null)).rejects.toThrow();
    expect(manager.store.state.paths.codex?.path).toBe(process.execPath);
    expect(context.runtimes).toEqual(original);
    expect(active.size).toBe(0);
  },
);
