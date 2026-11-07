import { beforeEach, expect, it, vi } from 'vitest';
import {
  withRuntimeConnection,
  type NativeSignInOptions,
  type NativeSignInProcess,
} from '@pitchcrew/adapters';
import type { CrewContext } from '../../crew/types.ts';
import { RuntimeAuthManager } from '../auth.ts';

vi.mock('../../crew/conversation-queue.ts', () => ({ drainConversationQueue: vi.fn() }));
let context: CrewContext;
let finish: () => void;
let fail: (error: Error) => void;
let options: NativeSignInOptions;
let process: NativeSignInProcess;
const authenticate = vi.fn(),
  clear = vi.fn(),
  start = vi.fn(),
  detect = vi.fn();
let manager: RuntimeAuthManager;
beforeEach(() => {
  vi.clearAllMocks();
  const active = new Map();
  const sessions = [{ id: 'fixture-session', runtime: 'codex', invalid: false }];
  context = {
    closing: false,
    runtimes: [{ id: 'codex', available: true, version: '1.0.0' }],
    modelCatalogs: new Map([['codex', {}]]),
    runtimeSetup: { withExecutables: (action: () => unknown) => action() },
    runtimeMaintenance: {
      active,
      isUpdating: (id: string) => active.has(id),
      busy: () => [],
      clearAuthentication: clear,
      authenticate,
    },
    board: {
      list: () => sessions,
      record: (_kind: string, session: (typeof sessions)[number]) => {
        sessions.splice(0, sessions.length, session);
      },
    },
    drainTasks: vi.fn(),
  } as unknown as CrewContext;
  process = {
    completion: new Promise<void>((resolve, reject) => {
      finish = resolve;
      fail = reject;
    }),
    respond: vi.fn(),
  };
  start.mockImplementation((_runtime: string, input: NativeSignInOptions) => {
    options = input;
    return process;
  });
  detect.mockResolvedValue({ id: 'codex', available: true, version: '1.0.0' });
  authenticate.mockResolvedValue({ status: 'authenticated' });
  manager = new RuntimeAuthManager(() => context, {
    executable: async () => '/fixture/codex',
    start,
    detect,
  });
});

const waiting = async () => {
  const initial = manager.start('codex');
  await expect.poll(() => start.mock.calls.length).toBe(1);
  options.onAction({ url: 'https://auth.openai.com/oauth/authorize?state=fixture' });
  return initial;
};

it('reserves synchronously, deduplicates starts and clears ephemeral actions after verified completion', async () => {
  const initial = manager.start('codex');
  expect(context.runtimeMaintenance.active.has('codex')).toBe(true);
  expect(manager.start('codex').id).toBe(initial.id);
  await expect.poll(() => start.mock.calls.length).toBe(1);
  options.onAction({ url: 'https://auth.openai.com/oauth/authorize?state=fixture' });
  expect(manager.current('codex').url).toBeDefined();
  finish();
  await expect.poll(() => manager.current('codex').stage).toBe('succeeded');
  expect(manager.current('codex').url).toBeUndefined();
  expect(context.runtimeMaintenance.active.has('codex')).toBe(false);
  expect(context.modelCatalogs.has('codex')).toBe(false);
  expect(clear).toHaveBeenCalledTimes(2);
  expect(authenticate).toHaveBeenCalledWith({ runtime: 'codex', model: '' }, true);
});

it('blocks busy or unavailable runtimes and leaves unsupported runtimes manual', () => {
  context.runtimeMaintenance.busy = () => ['A Writer is running.'];
  expect(() => manager.start('codex')).toThrow('idle');
  expect(manager.current('pi')).toMatchObject({ supported: false, stage: 'idle' });
  expect(() => manager.start('pi')).toThrow('CLI sign-in');
  context.runtimeMaintenance.busy = () => [];
  context.runtimes[0].available = false;
  expect(() => manager.start('codex')).toThrow('compatible');
  expect(start).not.toHaveBeenCalled();
});

it('requires an exact flow id and holds the runtime until the cancelled child stops', async () => {
  const state = await waiting();
  await expect(manager.cancel('codex', 'stale-flow')).rejects.toThrow('expired');
  const cancelled = manager.cancel('codex', state.id!);
  expect(options.signal.aborted).toBe(true);
  expect(context.runtimeMaintenance.active.has('codex')).toBe(true);
  fail(new Error('Fixture child stopped.'));
  expect(await cancelled).toMatchObject({ stage: 'cancelled' });
  expect(manager.current('codex').url).toBeUndefined();
  expect(context.runtimeMaintenance.active.has('codex')).toBe(false);
});

it('does not retain a submitted one-time code or expose raw failure output', async () => {
  const state = await waiting();
  options.onAction({ codeRequested: true });
  manager.respond('codex', state.id!, 'fixture-code');
  expect(process.respond).toHaveBeenCalledWith('fixture-code');
  expect(JSON.stringify(manager.current('codex'))).not.toContain('fixture-code');
  fail(new Error('Fixture upstream error with SECRET_RAW_OUTPUT'));
  await expect.poll(() => manager.current('codex').stage).toBe('failed');
  expect(JSON.stringify(manager.current('codex'))).not.toContain('SECRET_RAW_OUTPUT');
  expect(manager.current('codex').url).toBeUndefined();
});

it('reports completed but unverified when a native auth command finishes without account proof', async () => {
  await waiting();
  authenticate.mockResolvedValue({ status: 'unknown' });
  finish();
  await expect.poll(() => manager.current('codex').stage).toBe('completed');
  expect(manager.current('codex').detail).toContain('unverified');
});

it('declares supported native methods without exposing a general command launcher', () => {
  expect(manager.methods('cursor-agent')).toMatchObject([{ id: 'cursor', kind: 'browser' }]);
  expect(manager.methods('opencode')).toMatchObject([{ id: 'native', kind: 'terminal' }]);
  expect(manager.methods('pi')).toEqual([]);
  expect(() => manager.start('codex', 'untrusted-command')).toThrow('CLI sign-in');
  expect(start).not.toHaveBeenCalled();
});

it('binds code replies to the current interaction and consumes an acknowledged code only once', async () => {
  const state = await waiting();
  options.onAction({ codeRequested: true });
  const interaction = manager.current('codex').interaction!;
  expect(interaction.type).toBe('code');
  expect(() =>
    manager.respondInteraction('codex', state.id!, 'old-interaction', {
      type: 'code',
      code: 'fixture-code',
    }),
  ).toThrow('no longer active');
  expect(() =>
    manager.respondInteraction('codex', state.id!, interaction.id, {
      type: 'terminal',
      data: 'fixture-code',
    }),
  ).toThrow('does not match');
  manager.respondInteraction('codex', state.id!, interaction.id, {
    type: 'code',
    code: 'fixture-code',
  });
  expect(process.respond).toHaveBeenCalledOnce();
  expect(manager.current('codex')).toMatchObject({ stage: 'verifying' });
  expect(manager.current('codex').interaction).toBeUndefined();
  expect(JSON.stringify(manager.current('codex'))).not.toContain('fixture-code');
  expect(() =>
    manager.respondInteraction('codex', state.id!, interaction.id, {
      type: 'code',
      code: 'fixture-code',
    }),
  ).toThrow('no longer active');
  finish();
  await context.runtimeMaintenance.active.get('codex');
});

it('routes bounded terminal input only to the current flow and rejects overlapping account changes', async () => {
  const state = await waiting();
  process.respondInteraction = vi.fn();
  options.onAction({
    interaction: { id: 'fixture-terminal', type: 'terminal', output: 'Fictional sign-in prompt' },
  });
  expect(() => manager.logout('codex')).toThrow();
  expect(() =>
    manager.respondInteraction('codex', state.id!, 'fixture-terminal', {
      type: 'terminal',
      data: 'x'.repeat(4097),
    }),
  ).toThrow('too large');
  expect(() =>
    manager.respondInteraction('codex', state.id!, 'fixture-terminal', {
      type: 'terminal',
      data: '',
      size: { cols: 501, rows: 24 },
    }),
  ).toThrow('size');
  const response = {
    type: 'terminal',
    data: 'fixture-secret\r',
    size: { cols: 80, rows: 24 },
  } as const;
  manager.respondInteraction('codex', state.id!, 'fixture-terminal', response);
  expect(process.respondInteraction).toHaveBeenCalledWith(response);
  expect(JSON.stringify(manager.current('codex'))).not.toContain('fixture-secret');
  finish();
  await context.runtimeMaintenance.active.get('codex');
});

it('scopes sign-in and account checks through the selected runtime connection', async () => {
  const environment = vi.fn((_runtime: unknown, action: () => unknown) => action());
  context.runtimeConnections = {
    withEnvironment: environment,
  } as unknown as CrewContext['runtimeConnections'];
  await waiting();
  expect(environment).toHaveBeenCalledWith('codex', expect.any(Function));
  finish();
  await context.runtimeMaintenance.active.get('codex');
});

it('keeps setup readable and refuses to publish a flow when credential storage cannot be read', () => {
  context.runtimeConnections = {
    withEnvironment: () => {
      throw new Error('Fixture unreadable private settings');
    },
  } as unknown as CrewContext['runtimeConnections'];
  expect(manager.current('codex')).toMatchObject({
    id: null,
    stage: 'idle',
    canLogout: false,
    configurationError: expect.stringContaining('Recover authentication settings'),
  });
  expect(() => manager.start('codex')).toThrow('Recover authentication settings');
  expect(context.runtimeMaintenance.active.has('codex')).toBe(false);
  expect(manager.current('codex').id).toBeNull();
  expect(start).not.toHaveBeenCalled();
});

it('settles and releases a reserved flow if connection scoping fails after it was published', async () => {
  let readable = true;
  context.runtimeConnections = {
    withEnvironment: (_runtime: unknown, action: () => unknown) => {
      if (!readable) throw new Error('Fixture private settings became unreadable');
      return action();
    },
  } as unknown as CrewContext['runtimeConnections'];
  const initial = manager.start('codex');
  const completion = context.runtimeMaintenance.active.get('codex')!;
  readable = false;
  await expect(completion).resolves.toBeUndefined();
  expect(manager.current('codex')).toMatchObject({
    id: initial.id,
    stage: 'failed',
    detail: expect.stringContaining('Recover authentication settings'),
  });
  expect(manager.current('codex').finishedAt).toBeTruthy();
  expect(context.runtimeMaintenance.active.has('codex')).toBe(false);
  expect(start).not.toHaveBeenCalled();
});

it('reserves and deduplicates native method discovery before it can refresh private credentials', async () => {
  context.runtimes = [
    { id: 'grok', available: true, version: '1.0.45' },
  ] as CrewContext['runtimes'];
  Object.assign(context.runtimeMaintenance, { controller: new AbortController() });
  let resolve!: (methods: import('@pitchcrew/core').RuntimeAuthMethod[]) => void;
  let inspecting!: () => void;
  const inspected = new Promise<void>((done) => {
    inspecting = done;
  });
  const methods = vi.fn(async () => {
    inspecting();
    return new Promise<import('@pitchcrew/core').RuntimeAuthMethod[]>((done) => {
      resolve = done;
    });
  });
  manager = new RuntimeAuthManager(() => context, {
    executable: async () => '/fixture/grok',
    methods,
    start,
    detect,
  });
  const first = manager.discoverMethods('grok');
  expect(manager.discoverMethods('grok')).toBe(first);
  expect(context.runtimeMaintenance.active.has('grok')).toBe(true);
  expect(() => manager.start('grok', 'device')).toThrow('maintenance');
  await inspected;
  resolve([{ id: 'acp:fixture', label: 'Fictional browser method', kind: 'browser' }]);
  await expect(first).resolves.toMatchObject([{ id: 'acp:fixture' }]);
  expect(methods).toHaveBeenCalledOnce();
  expect(context.runtimeMaintenance.active.has('grok')).toBe(false);
  expect(manager.current('grok')).toMatchObject({
    stage: 'idle',
    methods: [{ id: 'acp:fixture' }],
  });
});

it('cancels method discovery on shutdown without publishing its late capability result', async () => {
  context.runtimes = [
    { id: 'grok', available: true, version: '1.0.45' },
  ] as CrewContext['runtimes'];
  Object.assign(context.runtimeMaintenance, { controller: new AbortController() });
  let inspecting!: () => void;
  const inspected = new Promise<void>((done) => {
    inspecting = done;
  });
  const methods = vi.fn(
    (_runtime: unknown, options: NativeSignInOptions) =>
      new Promise<import('@pitchcrew/core').RuntimeAuthMethod[]>((done) => {
        inspecting();
        options.signal.addEventListener(
          'abort',
          () => done([{ id: 'acp:late', label: 'Late result', kind: 'browser' }]),
          { once: true },
        );
      }),
  );
  manager = new RuntimeAuthManager(() => context, {
    executable: async () => '/fixture/grok',
    methods,
  });
  const request = manager.discoverMethods('grok');
  await inspected;
  context.closing = true;
  await manager.close();
  await request;
  expect(context.runtimeMaintenance.active.has('grok')).toBe(false);
  expect(manager.methods('grok').some((method) => method.id === 'acp:late')).toBe(false);
});

it('reserves sign-out, invalidates saved sessions and uses only its native logout operation', async () => {
  const logout = vi.fn((_runtime: unknown, input: NativeSignInOptions) => {
    options = input;
    return process;
  });
  manager = new RuntimeAuthManager(() => context, {
    executable: async () => '/fixture/codex',
    start,
    logout,
    detect,
  });
  await withRuntimeConnection('codex', { CODEX_API_KEY: '' }, async () => {
    authenticate.mockResolvedValue({ status: 'missing' });
    const state = manager.logout('codex');
    expect(state.stage).toBe('starting');
    expect(context.runtimeMaintenance.active.has('codex')).toBe(true);
    await expect.poll(() => logout.mock.calls.length).toBe(1);
    expect(start).not.toHaveBeenCalled();
    finish();
    await context.runtimeMaintenance.active.get('codex');
    expect(manager.current('codex')).toMatchObject({ stage: 'succeeded' });
    expect(manager.current('codex').detail).toContain('sign-out completed');
  });
});

it('shutdown cancels and waits for owned sign-in children, then discards all flow state', async () => {
  await waiting();
  context.closing = true;
  const closing = manager.close();
  expect(options.signal.aborted).toBe(true);
  fail(new Error('Fixture child stopped.'));
  await closing;
  expect(manager.current('codex')).toMatchObject({ id: null, stage: 'idle' });
});

it('refuses native sign-in when existing account sessions cannot be invalidated', async () => {
  vi.spyOn(context.board, 'record').mockImplementation(() => {
    throw new Error('Fixture SQLite write failure');
  });
  const initial = manager.start('codex');
  const completion = context.runtimeMaintenance.active.get('codex')!;
  await expect(completion).resolves.toBeUndefined();
  expect(start).not.toHaveBeenCalled();
  expect(manager.current('codex')).toMatchObject({ stage: 'failed' });
  expect(manager.current('codex').finishedAt).toBeTruthy();
  expect(context.runtimeMaintenance.active.has('codex')).toBe(false);
  expect(manager.start('codex').id).not.toBe(initial.id);
  await context.runtimeMaintenance.active.get('codex');
});

it('settles cancellation and clears private state even if final invalidation cannot read storage', async () => {
  const state = await waiting();
  vi.spyOn(context.board, 'list').mockImplementation(() => {
    throw new Error('Fixture database unavailable');
  });
  const cancelled = manager.cancel('codex', state.id!);
  fail(new Error('Fixture child stopped'));
  await expect(cancelled).resolves.toMatchObject({ stage: 'failed' });
  expect(manager.current('codex').url).toBeUndefined();
  expect(manager.current('codex').codeRequested).toBeUndefined();
  expect(manager.current('codex').finishedAt).toBeTruthy();
  expect(context.runtimeMaintenance.active.has('codex')).toBe(false);
});
