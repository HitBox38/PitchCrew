import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { readFile, rm, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  ConversationSession,
  RuntimeAuthResponse,
  RuntimeConnectionState,
  RuntimeInfo,
} from '@pitchcrew/core';
import { adapters, runtimeConnectionEnvironment } from '@pitchcrew/adapters';
import { cleanup, setup } from './helpers/daemon.ts';

let host: Awaited<ReturnType<typeof setup>>;
const key = 'fictional-http-runtime-key';
const inherited = 'fictional-inherited-runtime-key';
const runtime = (id: RuntimeInfo['id']): RuntimeInfo => ({
  id,
  available: true,
  version: '1.0.0',
  detail: 'Fictional compatible installation.',
  models: [],
  modelSource: 'runtime',
  modelDetail: 'Fictional catalog.',
});
const state = async (id = 'codex') =>
  (await host.request<RuntimeConnectionState>(`/runtimes/${id}/connection`)).result;
const save = async (id: string, changes: Record<string, string | null>, revision?: string) =>
  host.request<RuntimeConnectionState>(`/runtimes/${id}/connection`, 'PUT', {
    revision: revision ?? (await state(id)).revision,
    changes,
  });

beforeAll(async () => {
  host = await setup(false, { dev: false });
}, 60000);
beforeEach(async () => {
  await rm(host.daemon.service.runtimeConnections.store.path, { force: true });
  const manager = host.daemon.service.runtimeMaintenance;
  manager.context().runtimes = [runtime('codex'), runtime('opencode')];
  manager.authenticationEnabled = false;
  manager.clearAuthentication('codex');
  manager.clearAuthentication('opencode');
  vi.stubEnv('CODEX_API_KEY', inherited);
  vi.stubEnv('OPENAI_API_KEY', inherited);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
afterAll(async () => cleanup());

test('runtime credentials require a user session, forbid caching and never echo saved secrets', async () => {
  const before = await state();
  for (const method of ['GET', 'PUT']) {
    const denied = await fetch(`${host.daemon.url}/api/runtimes/codex/connection`, {
      method,
      headers: { 'content-type': 'application/json' },
      ...(method === 'PUT'
        ? { body: JSON.stringify({ revision: before.revision, changes: { CODEX_API_KEY: key } }) }
        : {}),
    });
    expect(denied.status).toBe(403);
  }
  expect((await state()).revision).toBe(before.revision);
  const stored = await save('codex', {
    CODEX_API_KEY: key,
    OPENAI_BASE_URL: 'https://fixture.example.test/v1',
  });
  expect(stored.response.status).toBe(200);
  const loaded = await host.request<RuntimeConnectionState>('/runtimes/codex/connection');
  for (const response of [stored.response, loaded.response]) {
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  }
  const field = loaded.result.fields.find((entry) => entry.name === 'CODEX_API_KEY');
  expect(field).toMatchObject({ source: 'saved', configured: true, secret: true });
  expect(field).not.toHaveProperty('value');
  expect(JSON.stringify(loaded.result)).not.toContain(key);
  expect(JSON.stringify(loaded.result)).not.toContain(inherited);
  expect(loaded.result.fields.find((entry) => entry.name === 'OPENAI_BASE_URL')?.value).toBe(
    'https://fixture.example.test/v1',
  );
  expect(await readFile(host.daemon.service.runtimeConnections.store.path, 'utf8')).toContain(key);
  expect(host.daemon.service.runtimes.some((entry) => entry.id === 'demo')).toBe(false);
});

test('stale writes cannot overwrite another runtime or silently replace a newer credential', async () => {
  const original = await state();
  expect((await save('codex', { CODEX_API_KEY: key }, original.revision)).response.status).toBe(
    200,
  );
  expect(
    (await save('opencode', { OPENAI_API_KEY: 'fictional-separate-opencode-key' })).response.status,
  ).toBe(200);
  const stale = await save(
    'codex',
    { CODEX_API_KEY: 'fictional-stale-replacement' },
    original.revision,
  );
  expect(stale.response.status).toBe(409);
  const connections = host.daemon.service.runtimeConnections;
  expect(
    connections.withEnvironment('codex', () => runtimeConnectionEnvironment().CODEX_API_KEY),
  ).toBe(key);
  expect(
    connections.withEnvironment('opencode', () => runtimeConnectionEnvironment().OPENAI_API_KEY),
  ).toBe('fictional-separate-opencode-key');
  expect(
    (await save('codex', { CODEX_API_KEY: '' })).result.fields.find(
      (entry) => entry.name === 'CODEX_API_KEY',
    ),
  ).toMatchObject({ source: 'disabled', configured: false });
  expect(
    connections.withEnvironment('codex', () => runtimeConnectionEnvironment().CODEX_API_KEY),
  ).toBe('');
  expect(
    (await save('codex', { CODEX_API_KEY: null })).result.fields.find(
      (entry) => entry.name === 'CODEX_API_KEY',
    ),
  ).toMatchObject({ source: 'inherited', configured: true });
  expect(
    connections.withEnvironment('codex', () => runtimeConnectionEnvironment().CODEX_API_KEY),
  ).toBe(inherited);
  expect(process.env.CODEX_API_KEY).toBe(inherited);
});

test('unsupported execution variables, malformed values and busy changes are rejected before persistence', async () => {
  const original = await state();
  const invalidChanges: Record<string, string | null>[] = [
    { PATH: key },
    { HOME: key },
    { NODE_OPTIONS: '--inspect' },
    { CODEX_API_KEY: 'line\nline' },
    { OPENAI_BASE_URL: 'https://user:password@fixture.example.test/v1' },
  ];
  for (const changes of invalidChanges) {
    const response = await save('codex', changes, original.revision);
    expect(response.response.status).toBe(400);
    expect(JSON.stringify(response.result)).not.toContain(key);
    expect((await state()).revision).toBe(original.revision);
  }
  const busy = vi
    .spyOn(host.daemon.service.runtimeMaintenance, 'busy')
    .mockReturnValue(['Fixture agent is running.']);
  const blocked = await save('codex', { CODEX_API_KEY: key }, original.revision);
  expect(blocked.response.status).toBe(400);
  expect(JSON.stringify(blocked.result)).toContain('idle');
  busy.mockRestore();
  expect((await state()).revision).toBe(original.revision);
  expect((await host.request('/runtimes/demo/connection')).response.status).toBe(400);
});

test('declared choice fields expose supported values and validation returns specific safe messages', async () => {
  const cases = [
    ['claude-code', 'CLAUDE_CODE_USE_BEDROCK', ['0', '1']],
    ['claude-code', 'CLAUDE_CODE_USE_VERTEX', ['0', '1']],
    ['claude-code', 'CLAUDE_CODE_USE_FOUNDRY', ['0', '1']],
    ['gemini-cli', 'GOOGLE_GENAI_USE_VERTEXAI', ['false', 'true', '0', '1']],
    ['goose', 'GOOSE_PROVIDER', ['openai', 'anthropic', 'google', 'ollama', 'openrouter']],
    [
      'hermes',
      'HERMES_INFERENCE_PROVIDER',
      ['openrouter', 'anthropic', 'openai-api', 'gemini', 'nous', 'xai', 'lmstudio'],
    ],
  ] as const;
  for (const [id, name, choices] of cases) {
    const original = await state(id);
    expect(original.fields.find((field) => field.name === name)?.choices).toEqual(choices);
    const invalid = await save(id, { [name]: 'fictional-unsupported-value' }, original.revision);
    expect(invalid.response.status).toBe(400);
    expect(invalid.result).toMatchObject({
      error: 'Choose one of the supported values shown for this authentication setting.',
    });
    expect((await state(id)).revision).toBe(original.revision);
  }
  const original = await state();
  const invalidEndpoint = await save(
    'codex',
    { OPENAI_BASE_URL: 'https://fixture.example.test/v1?invalid=1' },
    original.revision,
  );
  expect(invalidEndpoint.response.status).toBe(400);
  expect(invalidEndpoint.result).toMatchObject({
    error: 'Use an HTTP or HTTPS endpoint without credentials, query parameters or a fragment.',
  });
  expect((await state()).revision).toBe(original.revision);
});

test('invalid inherited non-secret endpoints expose only a private-value warning', async () => {
  const invalid =
    'https://fictional-user:fictional-inherited-endpoint-token@fixture.example.test/v1?private=1';
  vi.stubEnv('OPENAI_BASE_URL', invalid);
  const loaded = await host.request<RuntimeConnectionState>('/runtimes/codex/connection');
  expect(loaded.response.status).toBe(200);
  const field = loaded.result.fields.find((entry) => entry.name === 'OPENAI_BASE_URL');
  expect(field).toMatchObject({
    source: 'inherited',
    configured: true,
    invalidValue: { code: 'invalid_environment' },
  });
  expect(field).not.toHaveProperty('value');
  expect(JSON.stringify(loaded.result)).not.toMatch(
    /fictional-user|fictional-inherited-endpoint-token|private=1/,
  );
  expect(process.env.OPENAI_BASE_URL).toBe(invalid);
  const stored = await save('codex', { OPENAI_BASE_URL: 'https://fixture.example.test/v1' });
  expect(stored.response.status).toBe(200);
  expect(stored.result.fields.find((entry) => entry.name === 'OPENAI_BASE_URL')).toMatchObject({
    source: 'saved',
    value: 'https://fixture.example.test/v1',
  });
  expect(stored.result.fields.find((entry) => entry.name === 'OPENAI_BASE_URL')).not.toHaveProperty(
    'invalidValue',
  );
});

test('authentication and guarded launches see scoped runtime values without leaking credentials into shared state', async () => {
  await save('codex', { CODEX_API_KEY: key });
  await save('opencode', { OPENAI_API_KEY: 'fictional-other-runtime-key' });
  const observed: { runtime: string; value: string | undefined }[] = [];
  const manager = host.daemon.service.runtimeMaintenance;
  manager.authenticationEnabled = true;
  vi.spyOn(manager.host, 'authenticate').mockImplementation(async (config) => {
    await Promise.resolve();
    observed.push({
      runtime: config.runtime,
      value:
        runtimeConnectionEnvironment()[
          config.runtime === 'codex' ? 'CODEX_API_KEY' : 'OPENAI_API_KEY'
        ],
    });
    return {
      status: 'unknown',
      checkedAt: new Date().toISOString(),
      detail: 'Fictional metadata check only.',
      instructions: 'Fixture only.',
    };
  });
  const launched = await Promise.all(
    ['codex', 'opencode'].map((id) =>
      manager.guard({ runtime: id as 'codex' | 'opencode', model: '' }, async () => ({
        runtime: id,
        value: runtimeConnectionEnvironment()[id === 'codex' ? 'CODEX_API_KEY' : 'OPENAI_API_KEY'],
      })),
    ),
  );
  expect(observed).toEqual(
    expect.arrayContaining([
      { runtime: 'codex', value: key },
      { runtime: 'opencode', value: 'fictional-other-runtime-key' },
    ]),
  );
  expect(launched).toEqual([
    { runtime: 'codex', value: key },
    { runtime: 'opencode', value: 'fictional-other-runtime-key' },
  ]);
  expect(process.env.CODEX_API_KEY).toBe(inherited);
  expect(process.env.OPENAI_API_KEY).toBe(inherited);
  const snapshot = await host.request('/snapshot');
  const events = host.daemon.service.board.db.prepare('SELECT * FROM events').all();
  for (const value of [snapshot.result, events, manager.current()]) {
    expect(JSON.stringify(value)).not.toContain(key);
    expect(JSON.stringify(value)).not.toContain('fictional-other-runtime-key');
  }
  expect(await readdir(join(host.directory, 'runs')).catch(() => [])).toEqual([]);
});

test('generic auth responses are private, interaction-bound and bounded, and unknown completion stays unverified', async () => {
  const manager = host.daemon.service.runtimeAuth;
  const maintenance = host.daemon.service.runtimeMaintenance;
  maintenance.authenticationEnabled = true;
  vi.spyOn(manager, 'methods').mockReturnValue([
    { id: 'fixture-credentials', label: 'Fixture account', kind: 'credentials' },
  ]);
  vi.spyOn(manager.host, 'executable').mockResolvedValue(process.execPath);
  vi.spyOn(manager.host, 'detect').mockResolvedValue(runtime('codex'));
  vi.spyOn(maintenance.host, 'authenticate').mockResolvedValue({
    status: 'unknown',
    checkedAt: new Date().toISOString(),
    detail: 'Fixture readiness remains unverified.',
    instructions: 'Recheck.',
  });
  const supplied: RuntimeAuthResponse[] = [];
  vi.spyOn(manager.host, 'start').mockImplementation((_id, options) => {
    let complete!: () => void;
    const completion = new Promise<void>((resolve, reject) => {
      complete = resolve;
      options.signal.addEventListener('abort', () => reject(new Error('Fixture cancelled')), {
        once: true,
      });
    });
    queueMicrotask(() =>
      options.onAction({
        interaction: {
          id: 'fixture-private-interaction',
          type: 'credentials',
          fields: [{ name: 'code', label: 'Fixture secret', secret: true }],
        },
      }),
    );
    return {
      completion,
      respond: () => {},
      respondInteraction: (response) => {
        supplied.push(response);
        complete();
      },
    };
  });
  const started = await host.request<{ id: string }>('/runtimes/codex/auth/start', 'POST', {
    methodId: 'fixture-credentials',
  });
  expect(started.response.status).toBe(202);
  await expect.poll(() => manager.current('codex').stage).toBe('waiting');
  const payload = {
    flowId: started.result.id,
    interactionId: 'fixture-private-interaction',
    response: { type: 'credentials', values: { code: 'fictional-private-response' } },
  };
  const denied = await fetch(`${host.daemon.url}/api/runtimes/codex/auth/respond`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  expect(denied.status).toBe(403);
  expect(
    (
      await host.request('/runtimes/codex/auth/respond', 'POST', {
        ...payload,
        interactionId: 'stale-interaction',
      })
    ).response.status,
  ).toBe(400);
  expect(
    (
      await host.request('/runtimes/codex/auth/respond', 'POST', {
        ...payload,
        response: { type: 'credentials', values: { unexpected: key } },
      })
    ).response.status,
  ).toBe(400);
  expect(
    (
      await host.request('/runtimes/codex/auth/respond', 'POST', {
        ...payload,
        response: { type: 'terminal', data: 'x'.repeat(4097) },
      })
    ).response.status,
  ).toBe(400);
  expect(supplied).toEqual([]);
  expect(
    (await host.request('/runtimes/codex/auth/respond', 'POST', payload)).response.status,
  ).toBe(200);
  await expect.poll(() => manager.current('codex').stage).toBe('completed');
  expect(supplied).toEqual([
    { type: 'credentials', values: { code: 'fictional-private-response' } },
  ]);
  expect(JSON.stringify((await host.request('/snapshot')).result)).not.toContain(
    'fictional-private-response',
  );
  expect(
    JSON.stringify(host.daemon.service.board.db.prepare('SELECT * FROM events').all()),
  ).not.toContain('fictional-private-response');
});

test('unreadable authentication stays private and blocked until confirmed recovery backs up bytes and retains native accounts', async () => {
  const service = host.daemon.service;
  const connections = service.runtimeConnections;
  const maintenance = service.runtimeMaintenance;
  const context = maintenance.context();
  expect(
    (await host.request('/runtimes/codex/connection/recover', 'POST', { confirmed: true })).response
      .status,
  ).toBe(400);
  await save('codex', { CODEX_API_KEY: key });
  await save('opencode', { OPENAI_API_KEY: 'fictional-recovery-opencode-key' });
  const nativePath = join(await connections.authenticationDirectory('grok'), 'auth.json');
  const nativeBytes = '{"fixture":"fictional-native-grok-token"}';
  await writeFile(nativePath, nativeBytes, { mode: 0o600 });
  const session: ConversationSession = {
    id: 'fixture-recovery-session',
    nativeId: 'fixture-native-session',
    directoryId: 'fixture-directory',
    threadId: 'fixture-thread',
    roleId: 'scout',
    runtime: 'codex',
    revision: 'fixture-revision',
    lastMessageId: null,
    invalid: false,
  };
  service.board.record('conversation_session', session, 'user', 'Fictional recovery session');
  const selections = JSON.stringify({
    roles: service.board.list('role'),
    conversations: service.board.list('conversation'),
  });
  const bytes = (await readFile(connections.store.path, 'utf8')) + '\nfictional damaged suffix';
  await writeFile(connections.store.path, bytes, { mode: 0o600 });
  for (const adapter of Object.values(adapters)) {
    if (adapter.id !== 'demo') vi.spyOn(adapter, 'detect').mockResolvedValue(runtime(adapter.id));
  }
  const clear = vi.spyOn(maintenance, 'clearAuthentication');
  const nativeStart = vi.spyOn(service.runtimeAuth.host, 'start').mockImplementation(() => {
    throw new Error('Fictional recovery test must not start native authentication.');
  });
  context.modelCatalogs.set('codex', {
    catalog: { models: [], modelSource: 'runtime', modelDetail: 'Fictional cached catalog' },
    expiresAt: Date.now() + 300000,
  });
  const damaged = await host.request<RuntimeConnectionState>('/runtimes/codex/connection');
  expect(damaged.response.status).toBe(200);
  expect(damaged.response.headers.get('cache-control')).toBe('no-store');
  expect(damaged.result).toMatchObject({
    revision: '',
    fields: [],
    readError: { code: 'unreadable' },
  });
  expect(JSON.stringify(damaged.result)).not.toContain(key);
  expect(
    (await save('codex', { CODEX_API_KEY: 'fictional-must-not-save' }, crypto.randomUUID()))
      .response.status,
  ).toBe(400);
  expect((await host.request('/runtimes/codex/auth/start', 'POST', {})).response.status).toBe(400);
  expect(nativeStart).not.toHaveBeenCalled();
  expect(maintenance.isUpdating('codex')).toBe(false);
  const denied = await fetch(`${host.daemon.url}/api/runtimes/codex/connection/recover`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ confirmed: true }),
  });
  expect(denied.status).toBe(403);
  expect(
    (await host.request('/runtimes/codex/connection/recover', 'POST', { confirmed: false }))
      .response.status,
  ).toBe(400);
  expect(await readFile(connections.store.path, 'utf8')).toBe(bytes);
  await context.detect();
  expect(context.runtimes.find((entry) => entry.id === 'codex')?.available).toBe(false);
  expect(context.runtimes.find((entry) => entry.id === 'codex')?.configurationError).toMatchObject({
    code: 'credentials_unreadable',
    installationAvailable: true,
  });
  expect((await host.request('/snapshot')).response.status).toBe(200);
  const recovered = await host.request<RuntimeConnectionState & { backup: string }>(
    '/runtimes/codex/connection/recover',
    'POST',
    { confirmed: true },
  );
  expect(recovered.response.status).toBe(200);
  expect(recovered.response.headers.get('cache-control')).toBe('no-store');
  expect(recovered.result.backup).toMatch(/^credentials\.invalid-[a-f0-9-]{36}\.json$/);
  const backup = join(connections.store.folder, recovered.result.backup);
  expect(dirname(backup)).toBe(connections.store.folder);
  expect(await readFile(backup, 'utf8')).toBe(bytes);
  expect(await readFile(nativePath, 'utf8')).toBe(nativeBytes);
  expect(recovered.result.readError).toBeUndefined();
  expect(recovered.result.fields.find((field) => field.name === 'CODEX_API_KEY')).toMatchObject({
    source: 'inherited',
    configured: true,
  });
  expect(
    (await state('opencode')).fields.find((field) => field.name === 'OPENAI_API_KEY'),
  ).toMatchObject({ source: 'inherited', configured: true });
  expect(service.board.get<ConversationSession>('conversation_session', session.id).invalid).toBe(
    true,
  );
  expect(context.modelCatalogs.size).toBe(0);
  expect(clear).toHaveBeenCalledWith('codex');
  expect(clear).toHaveBeenCalledWith('grok');
  expect(context.runtimes.find((entry) => entry.id === 'codex')?.available).toBe(true);
  expect(
    JSON.stringify({
      roles: service.board.list('role'),
      conversations: service.board.list('conversation'),
    }),
  ).toBe(selections);
  expect(nativeStart).not.toHaveBeenCalled();
  for (const payload of [
    recovered.result,
    (await host.request('/snapshot')).result,
    service.board.db.prepare('SELECT * FROM events').all(),
  ]) {
    expect(JSON.stringify(payload)).not.toMatch(
      /fictional-(?:http-runtime-key|recovery-opencode-key|native-grok-token)/,
    );
  }
});

test('a native sign-out fixture reports its logout operation and retains saved conversations', async () => {
  vi.stubEnv('CODEX_API_KEY', '');
  const service = host.daemon.service;
  const manager = service.runtimeMaintenance;
  const auth = service.runtimeAuth;
  manager.authenticationEnabled = true;
  const before = JSON.stringify(service.board.list('conversation'));
  vi.spyOn(auth.host, 'executable').mockResolvedValue(process.execPath);
  vi.spyOn(auth.host, 'detect').mockResolvedValue(runtime('codex'));
  vi.spyOn(manager.host, 'authenticate').mockResolvedValue({
    status: 'missing',
    checkedAt: new Date().toISOString(),
    detail: 'Fictional native account is signed out.',
    instructions: 'Sign in again when ready.',
  });
  const logout = vi.spyOn(auth.host, 'logout').mockReturnValue({
    completion: Promise.resolve(),
    respond: () => {},
  });
  const started = await host.request('/runtimes/codex/auth/logout', 'POST', {});
  expect(started.response.status).toBe(202);
  await expect.poll(() => auth.current('codex').stage).toBe('succeeded');
  expect(auth.current('codex')).toMatchObject({
    operation: 'logout',
    detail: 'Native sign-out completed. Saved conversation history is kept.',
  });
  expect(logout).toHaveBeenCalledOnce();
  expect(JSON.stringify(service.board.list('conversation'))).toBe(before);
});
