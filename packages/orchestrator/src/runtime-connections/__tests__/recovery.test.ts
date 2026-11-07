import { afterEach, expect, test, vi } from 'vitest';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import type { RuntimeId } from '@pitchcrew/core';
import type { CrewContext } from '../../crew/types.ts';
import { RuntimeConnections } from '../index.ts';
import { RuntimeMaintenance } from '../../runtime-maintenance/index.ts';

const folders: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const folder of folders.splice(0)) {
    if (
      dirname(resolve(folder)) !== resolve(tmpdir()) ||
      !basename(folder).startsWith('pitchcrew-connection-recovery-')
    )
      throw new Error('Unsafe recovery fixture cleanup path.');
    await rm(folder, { recursive: true, force: true });
  }
});

const fixture = async (damaged = true) => {
  vi.stubEnv('CODEX_API_KEY', '');
  vi.stubEnv('XAI_API_KEY', '');
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-connection-recovery-'));
  folders.push(directory);
  const active = new Map<RuntimeId, Promise<void>>();
  const sessions = [
    { id: 'fixture-codex', runtime: 'codex', invalid: false },
    { id: 'fixture-grok', runtime: 'grok', invalid: false },
  ];
  const record = vi.fn((_kind: string, value: { id: string; invalid: boolean }) =>
    Object.assign(
      sessions.find((session) => session.id === value.id)!,
      value,
    ),
  );
  const detect = vi.fn(async () => []);
  const context = {
    closing: false,
    initializing: true,
    directory,
    board: { list: () => sessions, record },
    runtimeMaintenance: {
      controller: new AbortController(),
      active,
      isUpdating: (id: RuntimeId) => active.has(id),
      busy: vi.fn((_id: RuntimeId) => [] as string[]),
      clearAuthentication: vi.fn(),
    },
    modelCatalogs: new Map(),
    detect,
    drainTasks: vi.fn(async () => {}),
  } as unknown as CrewContext;
  const connections = new RuntimeConnections(directory, () => context);
  context.runtimeConnections = connections;
  await connections.configure('codex', {
    revision: connections.revision('codex'),
    changes: { CODEX_API_KEY: 'fictional-codex-key' },
  });
  await connections.configure('grok', {
    revision: connections.revision('grok'),
    changes: { XAI_API_KEY: 'fictional-grok-key' },
  });
  const auth = await connections.authenticationDirectory('grok');
  const nativeAuthPath = join(auth, 'auth.json'),
    nativeBytes = '{"fictional-native-provider":{"key":"fictional-native-token"}}';
  await writeFile(nativeAuthPath, nativeBytes, { mode: 0o600 });
  const source = await readFile(connections.store.path, 'utf8');
  const bytes = damaged ? source + '\nfictional damaged suffix' : source;
  if (damaged) await writeFile(connections.store.path, bytes, { mode: 0o600 });
  for (const session of sessions) session.invalid = false;
  record.mockClear();
  context.runtimeMaintenance.clearAuthentication = vi.fn();
  return {
    directory,
    connections,
    context,
    active,
    sessions,
    record,
    detect,
    bytes,
    nativeAuthPath,
    nativeBytes,
  };
};

test('releases a synchronous credential-scope failure before allowing recovery', async () => {
  const { directory, context, connections } = await fixture();
  const authenticate = vi.fn(async () => ({
    status: 'unknown' as const,
    checkedAt: new Date().toISOString(),
    detail: 'Fixture',
    instructions: 'Fixture',
  }));
  const maintenance = new RuntimeMaintenance(directory, () => context, { authenticate });
  maintenance.authenticationEnabled = true;
  vi.mocked(context.runtimeMaintenance.busy).mockImplementation((runtime) =>
    maintenance.preparations.get(runtime) ? ['Runtime account check is in progress.'] : [],
  );
  await expect(maintenance.authenticate({ runtime: 'codex', model: '' }, true)).rejects.toThrow(
    'cannot be read',
  );
  expect(authenticate).not.toHaveBeenCalled();
  expect(maintenance.preparations.get('codex')).toBe(0);
  await expect(connections.recover('codex')).resolves.toHaveProperty('backup');
});

test('keeps damaged credentials intact until explicit recovery, backs up exact bytes and retains native auth files', async () => {
  const { connections, context, active, sessions, bytes, nativeAuthPath, nativeBytes } =
    await fixture();
  expect(connections.status('codex')).toMatchObject({
    revision: '',
    fields: [],
    readError: { code: 'unreadable' },
  });
  expect(await readFile(connections.store.path, 'utf8')).toBe(bytes);
  const request = connections.recover('codex');
  expect(active.has('codex')).toBe(true);
  expect(active.has('grok')).toBe(true);
  const recovered = await request;
  expect(recovered.backup).toMatch(/^credentials\.invalid-[a-f0-9-]{36}\.json$/);
  const backup = join(connections.store.folder, recovered.backup);
  expect(dirname(backup)).toBe(connections.store.folder);
  expect(await readFile(backup, 'utf8')).toBe(bytes);
  expect(await readFile(nativeAuthPath, 'utf8')).toBe(nativeBytes);
  expect(recovered.readError).toBeUndefined();
  expect(recovered.fields.find((field) => field.name === 'CODEX_API_KEY')).toMatchObject({
    source: 'unset',
    configured: false,
  });
  expect(
    connections.status('grok').fields.find((field) => field.name === 'XAI_API_KEY'),
  ).toMatchObject({ source: 'unset', configured: false });
  expect(JSON.stringify(recovered)).not.toMatch(/fictional-(?:codex-key|grok-key|native-token)/);
  expect(sessions.every((session) => session.invalid)).toBe(true);
  expect(context.runtimeMaintenance.clearAuthentication).toHaveBeenCalledWith('codex');
  expect(context.runtimeMaintenance.clearAuthentication).toHaveBeenCalledWith('grok');
  expect(active.size).toBe(0);
  if (process.platform !== 'win32') expect((await stat(backup)).mode & 0o777).toBe(0o600);
});

test.each(['running-work', 'setup'] as const)(
  'blocks the shared recovery when another runtime has %s',
  async (busy) => {
    const { connections, context, active, record, bytes } = await fixture();
    if (busy === 'running-work')
      vi.mocked(context.runtimeMaintenance.busy).mockImplementation((id) =>
        id === 'cursor-agent' ? ['A fictional Cursor turn is active.'] : [],
      );
    else active.set('pi', Promise.resolve());
    expect(() => connections.recover('codex')).toThrow('Wait for runtime work');
    expect(await readFile(connections.store.path, 'utf8')).toBe(bytes);
    expect(
      (await readdir(connections.store.folder)).filter((name) =>
        name.startsWith('credentials.invalid-'),
      ),
    ).toEqual([]);
    expect(record).not.toHaveBeenCalled();
  },
);

test('keeps the damaged file and native credentials when pre-reset durable session invalidation fails', async () => {
  const { connections, active, record, bytes, nativeAuthPath, nativeBytes } = await fixture();
  record.mockImplementationOnce(() => {
    throw new Error('Fixture session storage failed');
  });
  await expect(connections.recover('codex')).rejects.toThrow('Fixture session storage failed');
  expect(await readFile(connections.store.path, 'utf8')).toBe(bytes);
  expect(await readFile(nativeAuthPath, 'utf8')).toBe(nativeBytes);
  expect(
    (await readdir(connections.store.folder)).filter((name) =>
      name.startsWith('credentials.invalid-'),
    ),
  ).toEqual([]);
  expect(active.size).toBe(0);
});

test('rejects recovery of readable settings without touching the credentials or sessions', async () => {
  const { connections, active, record, bytes, nativeAuthPath, nativeBytes } = await fixture(false);
  expect(() => connections.recover('codex')).toThrow('readable');
  expect(await readFile(connections.store.path, 'utf8')).toBe(bytes);
  expect(await readFile(nativeAuthPath, 'utf8')).toBe(nativeBytes);
  expect(record).not.toHaveBeenCalled();
  expect(active.size).toBe(0);
});

test('acknowledges a committed reset even if the following installation health refresh fails', async () => {
  const { connections, detect, bytes, active } = await fixture();
  detect.mockRejectedValueOnce(new Error('Fixture health refresh failed'));
  const recovered = await connections.recover('codex');
  expect(detect).toHaveBeenCalledOnce();
  expect(recovered.readError).toBeUndefined();
  expect(await readFile(join(connections.store.folder, recovered.backup), 'utf8')).toBe(bytes);
  await expect(stat(connections.store.path)).rejects.toMatchObject({ code: 'ENOENT' });
  expect(active.size).toBe(0);
});
