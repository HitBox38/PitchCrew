import { afterEach, expect, test, vi } from 'vitest';
import { mkdtemp, readFile, rm, stat, symlink, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { runtimeConnectionEnvironment, runtimeConnectionDirectory } from '@pitchcrew/adapters';
import type { RuntimeId } from '@pitchcrew/core';
import type { CrewContext } from '../../crew/types.ts';
import { RuntimeConnections, RuntimeConnectionConflict } from '../index.ts';
import { RuntimeMaintenance } from '../../runtime-maintenance/index.ts';

const folders: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const folder of folders.splice(0)) {
    if (
      dirname(resolve(folder)) !== resolve(tmpdir()) ||
      !basename(folder).startsWith('pitchcrew-runtime-connections-')
    )
      throw new Error('Unsafe fixture cleanup path.');
    await rm(folder, { recursive: true, force: true });
  }
});
const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-runtime-connections-'));
  folders.push(directory);
  const active = new Map<RuntimeId, Promise<void>>();
  const context = {
    closing: false,
    initializing: true,
    directory,
    board: {
      list: () => [{ id: 'fixture-session', runtime: 'codex', invalid: false }],
      record: vi.fn(),
    },
    modelCatalogs: new Map([['codex', { fixture: true }]]),
    drainTasks: vi.fn(),
    runtimeMaintenance: {
      controller: new AbortController(),
      active,
      busy: vi.fn(() => [] as string[]),
      isUpdating: (id: RuntimeId) => active.has(id),
      clearAuthentication: vi.fn(),
    },
  } as unknown as CrewContext;
  const connections = new RuntimeConnections(directory, () => context);
  context.runtimeConnections = connections;
  return { connections, context, active, directory };
};

test('keeps secrets write-only while saving separate runtime choices and explicit inheritance', async () => {
  vi.stubEnv('CODEX_API_KEY', 'fictional-inherited-key');
  vi.stubEnv('OPENAI_API_KEY', 'fictional-other-runtime-key');
  const { connections, context, active } = await fixture();
  const initial = connections.status('codex');
  const starting = connections.configure('codex', {
    revision: initial.revision,
    changes: {
      CODEX_API_KEY: 'fictional-saved-key',
      OPENAI_BASE_URL: 'https://api.example.test/v1',
    },
  });
  expect(active.has('codex')).toBe(true);
  const saved = await starting;
  expect(saved.revision).not.toBe(initial.revision);
  expect(JSON.stringify(saved)).not.toContain('fictional-saved-key');
  expect(saved.fields.find((field) => field.name === 'CODEX_API_KEY')).toMatchObject({
    configured: true,
    source: 'saved',
  });
  expect(saved.fields.find((field) => field.name === 'CODEX_API_KEY')).not.toHaveProperty('value');
  expect(saved.fields.find((field) => field.name === 'OPENAI_BASE_URL')?.value).toBe(
    'https://api.example.test/v1',
  );
  expect(context.board.record).toHaveBeenCalled();
  expect(context.modelCatalogs.has('codex')).toBe(false);
  expect(context.runtimeMaintenance.clearAuthentication).toHaveBeenCalledWith('codex');
  expect(active.size).toBe(0);
  expect(
    connections.withEnvironment('codex', () => runtimeConnectionEnvironment().CODEX_API_KEY),
  ).toBe('fictional-saved-key');
  expect(
    connections.withEnvironment('opencode', () => runtimeConnectionEnvironment().OPENAI_API_KEY),
  ).toBe('fictional-other-runtime-key');
  const disabled = await connections.configure('codex', {
    revision: saved.revision,
    changes: { CODEX_API_KEY: '' },
  });
  expect(disabled.fields.find((field) => field.name === 'CODEX_API_KEY')).toMatchObject({
    source: 'disabled',
    configured: false,
  });
  expect(
    connections.withEnvironment('codex', () => runtimeConnectionEnvironment().CODEX_API_KEY),
  ).toBe('');
  const inherited = await connections.configure('codex', {
    revision: disabled.revision,
    changes: { CODEX_API_KEY: null },
  });
  expect(inherited.fields.find((field) => field.name === 'CODEX_API_KEY')).toMatchObject({
    source: 'inherited',
    configured: true,
  });
  expect(JSON.stringify(inherited)).not.toContain('fictional-inherited-key');
  if (process.platform !== 'win32')
    expect((await stat(connections.store.path)).mode & 0o777).toBe(0o600);
});

test('rejects stale, unsafe and busy changes before modifying settings or sessions', async () => {
  const { connections, context } = await fixture();
  const initial = connections.status('codex');
  await connections.configure('codex', {
    revision: initial.revision,
    changes: { CODEX_API_KEY: 'fictional-current-key' },
  });
  vi.mocked(context.board.record).mockClear();
  await expect(
    connections.configure('codex', {
      revision: initial.revision,
      changes: { CODEX_API_KEY: 'fictional-stale-key' },
    }),
  ).rejects.toBeInstanceOf(RuntimeConnectionConflict);
  expect(context.board.record).not.toHaveBeenCalled();
  for (const name of ['HOME', 'PATH', 'NODE_OPTIONS', 'OPENCODE_CONFIG_CONTENT'])
    expect(() =>
      connections.configure('codex', {
        revision: connections.revision('codex'),
        changes: { [name]: 'fictional-value' },
      }),
    ).toThrow('not supported');
  vi.mocked(context.runtimeMaintenance.busy).mockReturnValue(['Writer is running.']);
  expect(() =>
    connections.configure('codex', { revision: connections.revision('codex'), changes: {} }),
  ).toThrow('become idle');
  expect(
    connections.withEnvironment('codex', () => runtimeConnectionEnvironment().CODEX_API_KEY),
  ).toBe('fictional-current-key');
});

test('does not change credentials when durable native session invalidation fails', async () => {
  vi.stubEnv('CODEX_API_KEY', 'fictional-inherited-key');
  const { connections, context, active } = await fixture();
  vi.mocked(context.board.record).mockImplementation(() => {
    throw new Error('Fixture session write failed');
  });
  await expect(
    connections.configure('codex', {
      revision: connections.revision('codex'),
      changes: { CODEX_API_KEY: 'fictional-rejected-key' },
    }),
  ).rejects.toThrow('Fixture session write failed');
  expect(
    connections.withEnvironment('codex', () => runtimeConnectionEnvironment().CODEX_API_KEY),
  ).toBe('fictional-inherited-key');
  expect(active.size).toBe(0);
});

test('keeps the last saved credentials if a replacement write fails after session invalidation', async () => {
  const { connections, context, active } = await fixture();
  const saved = await connections.configure('codex', {
    revision: connections.revision('codex'),
    changes: { CODEX_API_KEY: 'fictional-original-key' },
  });
  vi.mocked(context.board.record).mockClear();
  vi.spyOn(connections.store, 'save').mockImplementationOnce(() => {
    throw new Error('Fixture storage is unavailable');
  });
  await expect(
    connections.configure('codex', {
      revision: saved.revision,
      changes: { CODEX_API_KEY: 'fictional-unsaved-key' },
    }),
  ).rejects.toThrow('Fixture storage is unavailable');
  expect(context.board.record).toHaveBeenCalled();
  expect(
    connections.withEnvironment('codex', () => runtimeConnectionEnvironment().CODEX_API_KEY),
  ).toBe('fictional-original-key');
  expect(connections.revision('codex')).toBe(saved.revision);
  expect(active.size).toBe(0);
});

test('does not replace damaged credentials or accept injected controls from the saved file', async () => {
  const { connections } = await fixture();
  await connections.configure('codex', {
    revision: connections.revision('codex'),
    changes: { CODEX_API_KEY: 'fictional-key' },
  });
  const damaged =
    '{"version":1,"runtimes":{"codex":{"revision":"00000000-0000-4000-8000-000000000000","values":{"NODE_OPTIONS":"fictional-injected-control"}}}}';
  await writeFile(connections.store.path, damaged);
  expect(connections.status('codex').readError).toMatchObject({ code: 'unreadable' });
  expect(() => connections.withEnvironment('codex', () => {})).toThrow(
    'Saved runtime credentials cannot be read',
  );
  expect(await readFile(connections.store.path, 'utf8')).toBe(damaged);
});

test('provides the same contained private auth directory to login and run scopes and rejects redirected homes', async () => {
  const { connections, directory } = await fixture();
  const target = await connections.authenticationDirectory('grok');
  expect(target).toBe(join(directory, 'runtime-auth', 'grok'));
  expect(connections.withEnvironment('grok', () => runtimeConnectionDirectory())).toBe(target);
  const outside = join(directory, 'redirected');
  await mkdir(outside);
  await symlink(
    outside,
    join(directory, 'runtime-auth', 'pi'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await expect(connections.authenticationDirectory('pi')).rejects.toThrow(
    'private runtime authentication folder is unavailable',
  );
});

test('uses the saved connection for authentication, native metadata and run admission with revision-aware readiness', async () => {
  const { connections, context, directory } = await fixture();
  const first = await connections.configure('codex', {
    revision: connections.revision('codex'),
    changes: { CODEX_API_KEY: 'fictional-first-key' },
  });
  const observed: Array<string | undefined> = [];
  const maintenance = new RuntimeMaintenance(directory, () => context, {
    authenticate: async () => {
      observed.push(runtimeConnectionEnvironment().CODEX_API_KEY);
      return {
        status: 'authenticated',
        checkedAt: new Date().toISOString(),
        detail: 'Fictional readiness',
        instructions: '',
      };
    },
  });
  context.runtimeMaintenance = maintenance;
  maintenance.authenticationEnabled = true;
  vi.spyOn(maintenance, 'busy').mockReturnValue([]);
  const config = { runtime: 'codex' as const, model: '' };
  expect((await maintenance.authenticate(config)).status).toBe('authenticated');
  expect(
    await maintenance.metadata('codex', async () => runtimeConnectionEnvironment().CODEX_API_KEY),
  ).toBe('fictional-first-key');
  expect(
    await maintenance.guard(config, async () => runtimeConnectionEnvironment().CODEX_API_KEY),
  ).toBe('fictional-first-key');
  expect(observed).toEqual(['fictional-first-key']);
  await connections.configure('codex', {
    revision: first.revision,
    changes: { CODEX_API_KEY: 'fictional-second-key' },
  });
  await maintenance.authenticate(config);
  expect(observed).toEqual(['fictional-first-key', 'fictional-second-key']);
  await maintenance.close();
});
