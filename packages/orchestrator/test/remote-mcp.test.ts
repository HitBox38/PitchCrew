import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import type { RemoteMcpInfo } from '@pitchcrew/core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RemoteMcpAccess } from '../src/remote-mcp/index.ts';
import { findTunnelExecutable, openRemoteTunnel } from '../src/remote-mcp/tunnel.ts';
import { createDaemon } from '../src/server.ts';
import { isolateRuntimes, restoreRuntimes } from './helpers/daemon.ts';

vi.mock('../src/remote-mcp/tunnel.ts', () => ({
  findTunnelExecutable: vi.fn(),
  openRemoteTunnel: vi.fn(),
}));

const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
const nativeFetch = globalThis.fetch;
const cleanups: (() => Promise<void>)[] = [];
type TunnelPlan = {
  tunnel: Awaited<ReturnType<typeof openRemoteTunnel>>;
  connection: ReturnType<typeof deferred<void>>;
  probe: ReturnType<typeof deferred<void>>;
  cleanup: ReturnType<typeof deferred<void>>;
  opened: ReturnType<typeof deferred<URL>>;
  checked: ReturnType<typeof deferred<void>>;
  closeStarted: ReturnType<typeof deferred<void>>;
  exited: ReturnType<typeof deferred<void>>;
  local: URL | undefined;
};
const plans: TunnelPlan[] = [];
let nextPlan = 0;

const tunnelPlan = ({
  holdTunnel = false,
  holdProbe = false,
  holdClose = false,
} = {}): TunnelPlan => {
  const index: number = plans.length;
  const connection = deferred();
  const probe = deferred();
  const cleanup = deferred();
  const opened = deferred<URL>();
  const checked = deferred();
  const closeStarted = deferred();
  const exited = deferred();
  if (!holdTunnel) connection.resolve();
  if (!holdProbe) probe.resolve();
  if (!holdClose) cleanup.resolve();
  const tunnel = {
    origin: new URL(`https://fixture-${index}.trycloudflare.com`),
    closed: exited.promise,
    close: vi.fn(async () => {
      closeStarted.resolve();
      await cleanup.promise;
      exited.resolve();
    }),
  };
  const plan = {
    tunnel,
    connection,
    probe,
    cleanup,
    opened,
    checked,
    closeStarted,
    exited,
    local: undefined as URL | undefined,
  };
  plans.push(plan);
  return plan;
};

beforeEach(() => {
  nextPlan = 0;
  vi.mocked(findTunnelExecutable).mockResolvedValue(process.execPath);
  vi.mocked(openRemoteTunnel).mockImplementation(async (local) => {
    const plan = plans[nextPlan++];
    if (!plan) throw new Error('Unexpected tunnel launch.');
    plan.local = local;
    plan.opened.resolve(local);
    await plan.connection.promise;
    return plan.tunnel;
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const plan = plans.find((entry) => entry.tunnel.origin.origin === url.origin);
      if (plan && url.pathname === '/connection-check') {
        plan.checked.resolve();
        await plan.probe.promise;
        return nativeFetch(new URL(url.pathname, plan.local!), init);
      }
      return nativeFetch(input, init);
    }),
  );
});

afterEach(async () => {
  for (const plan of plans) {
    plan.connection.resolve();
    plan.probe.resolve();
    plan.cleanup.resolve();
  }
  for (const close of cleanups.splice(0).reverse()) await close();
  plans.splice(0);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  restoreRuntimes();
});

const directory = async () => {
  const value = resolve(await mkdtemp(join(tmpdir(), 'pitchcrew-remote-manager-')));
  cleanups.push(async () => {
    expect(dirname(value)).toBe(resolve(tmpdir()));
    expect(basename(value)).toMatch(/^pitchcrew-remote-manager-/);
    await rm(value, { recursive: true, force: true });
  });
  return value;
};
const manager = async () => {
  const folder = await directory();
  const access = new RemoteMcpAccess(folder, async () => ({ ok: true }));
  cleanups.push(() => access.stop().then(() => {}));
  return { access, folder };
};
const ready = async (access: RemoteMcpAccess) => {
  await vi.waitFor(async () => expect((await access.info()).state).toBe('ready'));
};

it('coalesces starts and reports ready only after its own public probe reaches the isolated listener', async () => {
  const plan = tunnelPlan({ holdProbe: true });
  const { access } = await manager();
  expect((await access.info()).state).toBe('off');
  const started = await Promise.all([access.start(), access.start()]);
  expect(started.map((entry) => entry.state)).toEqual(['starting', 'starting']);
  await plan.checked.promise;
  expect(openRemoteTunnel).toHaveBeenCalledOnce();
  expect(await access.info()).toMatchObject({ state: 'starting', url: null });
  expect((await nativeFetch(new URL('/api/snapshot', plan.local!))).status).toBe(404);
  plan.probe.resolve();
  await ready(access);
  expect((await access.info()).url).toBe(new URL('/mcp', plan.tunnel.origin).href);
  expect((await access.start()).state).toBe('ready');
  expect(openRemoteTunnel).toHaveBeenCalledOnce();
  expect((await access.stop()).state).toBe('off');
  expect(plan.tunnel.close).toHaveBeenCalledOnce();
  await expect(nativeFetch(new URL('/connection-check', plan.local!))).rejects.toThrow();
});

it('waits for cancelled startup resources before a queued restart takes ownership', async () => {
  const first = tunnelPlan({ holdTunnel: true });
  const second = tunnelPlan();
  const { access } = await manager();
  await access.start();
  await first.opened.promise;
  const stopping = access.stop();
  const restarting = access.start();
  first.connection.resolve();
  expect((await stopping).state).toBe('off');
  expect((await restarting).state).toBe('starting');
  await ready(access);
  expect(first.tunnel.close).toHaveBeenCalledOnce();
  expect(second.tunnel.close).not.toHaveBeenCalled();
  expect((await access.info()).url).toBe(new URL('/mcp', second.tunnel.origin).href);
  expect((await nativeFetch(new URL('/connection-check', second.local!))).status).toBe(200);
});

const grant = async (access: RemoteMcpAccess, plan: ReturnType<typeof tunnelPlan>) => {
  const redirect = 'https://bot.example/callback';
  const registered = await nativeFetch(new URL('/register', plan.local!), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Manager fixture',
      redirect_uris: [redirect],
      token_endpoint_auth_method: 'none',
      scope: 'pitchcrew:access',
    }),
  });
  expect(registered.status).toBe(201);
  const client = (await registered.json()) as { client_id: string };
  const verifier = 'v'.repeat(64);
  const resource = new URL('/mcp', plan.tunnel.origin).href;
  const authorize = new URL('/authorize', plan.local!);
  authorize.search = new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: redirect,
    response_type: 'code',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    resource,
  }).toString();
  const request = await nativeFetch(authorize, { redirect: 'manual' });
  expect(request.status).toBe(302);
  const ticket = new URL(request.headers.get('location')!).pathname;
  await access.decide((await access.info()).requests[0].id, { approved: true, write: false });
  const decision = await nativeFetch(new URL(ticket + '/status', plan.local!));
  const response = (await decision.json()) as { redirect: string };
  const tokens = await nativeFetch(new URL('/token', plan.local!), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: client.client_id,
      grant_type: 'authorization_code',
      code: new URL(response.redirect).searchParams.get('code')!,
      code_verifier: verifier,
      redirect_uri: redirect,
      resource,
    }),
  });
  expect(tokens.status).toBe(200);
  expect((await access.info()).clients).toHaveLength(1);
};

it.each([false, true])(
  'fails closed and removes saved grants after an unexpected tunnel exit (cleanup failure=%s)',
  async (cleanupFailure) => {
    const plan = tunnelPlan();
    const { access, folder } = await manager();
    await access.start();
    await ready(access);
    await grant(access, plan);
    if (cleanupFailure) plan.exited.reject(new Error('Fixture temporary-folder cleanup failed'));
    else plan.exited.resolve();
    await vi.waitFor(async () => expect((await access.info()).state).toBe('failed'));
    expect(await access.info()).toMatchObject({
      url: null,
      requests: [],
      clients: [],
      error: expect.stringContaining('stopped'),
    });
    expect(JSON.parse(await readFile(join(folder, 'remote-mcp.json'), 'utf8')).grants).toEqual([]);
    await expect(nativeFetch(new URL('/connection-check', plan.local!))).rejects.toThrow();
  },
);

it('finishes unexpected-exit cleanup before a restart can own a new listener', async () => {
  const first = tunnelPlan({ holdClose: true });
  const second = tunnelPlan();
  const { access, folder } = await manager();
  await access.start();
  await ready(access);
  await grant(access, first);
  first.exited.resolve();
  await first.closeStarted.promise;
  expect((await access.info()).clients).toEqual([]);
  let stopped = false;
  const stopping = access.stop().then((result) => {
    stopped = true;
    return result;
  });
  const restarting = access.start();
  await readFile(join(folder, 'remote-mcp.json'), 'utf8');
  expect(stopped).toBe(false);
  expect(openRemoteTunnel).toHaveBeenCalledOnce();
  first.cleanup.resolve();
  expect((await stopping).state).toBe('off');
  await restarting;
  await ready(access);
  expect((await access.info()).url).toBe(new URL('/mcp', second.tunnel.origin).href);
  expect(second.tunnel.close).not.toHaveBeenCalled();
  expect((await nativeFetch(new URL('/connection-check', second.local!))).status).toBe(200);
  const state = JSON.parse(await readFile(join(folder, 'remote-mcp.json'), 'utf8'));
  expect(state.grants).toEqual([]);
});

it('keeps every management route behind the local user session, before parsing anonymous or external-agent bodies', async () => {
  isolateRuntimes();
  const folder = await directory();
  const daemon = await createDaemon({
    directory: folder,
    port: 15686,
    dev: false,
    ui: false,
    seedSkills: false,
  });
  cleanups.push(() => daemon.close());
  const host = '127.0.0.1:15686';
  const id = randomUUID();
  const paths = [
    ['GET', '/api/remote-mcp'],
    ['POST', '/api/remote-mcp/start'],
    ['POST', '/api/remote-mcp/stop'],
    ['POST', `/api/remote-mcp/requests/${id}/decision`],
    ['DELETE', `/api/remote-mcp/clients/${id}`],
  ] as const;
  for (const authorization of ['', 'Bearer ' + 'a'.repeat(64)])
    for (const [method, url] of paths) {
      const denied = await daemon.app.inject({
        method,
        url,
        headers: { host, authorization, 'content-type': 'application/json' },
        ...(method === 'POST' ? { payload: '{' } : {}),
      });
      expect(denied.statusCode).toBe(403);
    }
  expect(openRemoteTunnel).not.toHaveBeenCalled();
  const root = await daemon.app.inject({ url: '/', headers: { host } });
  const headers = {
    host,
    'x-pitchcrew-client': 'ui',
    cookie: String(root.headers['set-cookie']).split(';')[0],
  };
  const initial = await daemon.app.inject({ url: '/api/remote-mcp', headers });
  expect(initial.statusCode).toBe(200);
  expect(initial.headers['cache-control']).toBe('no-store');
  expect(initial.json<RemoteMcpInfo>().state).toBe('off');
  const plan = tunnelPlan();
  const start = await daemon.app.inject({
    method: 'POST',
    url: '/api/remote-mcp/start',
    headers,
    payload: {},
  });
  expect(start.statusCode).toBe(200);
  expect(start.json<RemoteMcpInfo>().state).toBe('starting');
  await plan.opened.promise;
  const stop = await daemon.app.inject({
    method: 'POST',
    url: '/api/remote-mcp/stop',
    headers,
    payload: {},
  });
  expect(stop.statusCode).toBe(200);
  expect(stop.json<RemoteMcpInfo>()).toMatchObject({ state: 'off', requests: [], clients: [] });
  expect(daemon.service.board.list('run')).toEqual([]);
});
