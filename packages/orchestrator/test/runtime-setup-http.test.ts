import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import type { RuntimeAuthState, RuntimeSetupInfo } from '@pitchcrew/core';
import { setup, cleanup } from './helpers/daemon.ts';

let host: Awaited<ReturnType<typeof setup>>;
const info: RuntimeSetupInfo = {
  id: 'codex',
  configuredPath: null,
  executable: '/fixture/codex',
  realPath: '/fixture/codex',
  source: 'automatic',
  installer: 'fixture',
  canInstall: false,
  installDetail: 'Fixture only',
  busyReasons: [],
};
const auth: RuntimeAuthState = {
  runtime: 'codex',
  supported: true,
  id: 'fixture-flow',
  stage: 'waiting',
  detail: 'Fixture native sign-in',
  url: 'https://auth.openai.com/authorize?state=fixture-private',
  startedAt: '2026-11-07T00:00:00Z',
  expiresAt: '2026-11-07T00:05:00Z',
  finishedAt: null,
};
beforeAll(async () => {
  host = await setup(false, { dev: false });
}, 60000);
afterEach(() => vi.restoreAllMocks());
afterAll(async () => cleanup());

test('setup diagnostics and ephemeral sign-in state require the UI session and forbid caching', async () => {
  const current = vi.spyOn(host.daemon.service.runtimeAuth, 'current').mockReturnValue(auth);
  const methods = vi
    .spyOn(host.daemon.service.runtimeAuth, 'discoverMethods')
    .mockResolvedValue([{ id: 'chatgpt', label: 'ChatGPT', kind: 'browser' }]);
  vi.spyOn(host.daemon.service.runtimeSetup, 'info').mockResolvedValue(info);
  const denied = await fetch(`${host.daemon.url}/api/runtimes/codex/auth`);
  expect(denied.status).toBe(403);
  expect(current).not.toHaveBeenCalled();
  expect((await fetch(`${host.daemon.url}/api/runtimes/codex/auth/methods`)).status).toBe(403);
  expect(methods).not.toHaveBeenCalled();
  expect(
    (
      await fetch(`${host.daemon.url}/api/runtimes/codex/auth/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
    ).status,
  ).toBe(403);
  for (const path of [
    '/runtimes/codex/setup',
    '/runtimes/codex/auth',
    '/runtimes/codex/auth/methods',
  ]) {
    const response = await host.request(path);
    expect(response.response.status).toBe(200);
    expect(response.response.headers.get('cache-control')).toBe('no-store');
    expect(response.response.headers.get('referrer-policy')).toBe('no-referrer');
  }
  const snapshot = await host.request('/snapshot');
  expect(JSON.stringify(snapshot.result)).not.toContain('fixture-private');
  expect(JSON.stringify(snapshot.result)).not.toContain('fixture-flow');
  expect(host.daemon.service.runtimes.some((runtime) => runtime.id === 'demo')).toBe(false);
});

test('setup routes accept only typed runtime selections and operation-scoped cancellation', async () => {
  const configure = vi.spyOn(host.daemon.service.runtimeSetup, 'configure').mockResolvedValue(info);
  const install = vi.spyOn(host.daemon.service.runtimeSetup, 'install').mockResolvedValue(info);
  const cancel = vi.spyOn(host.daemon.service.runtimeSetup, 'cancel').mockResolvedValue(info);
  const start = vi.spyOn(host.daemon.service.runtimeAuth, 'start').mockReturnValue(auth);
  const logout = vi.spyOn(host.daemon.service.runtimeAuth, 'logout').mockReturnValue(auth);
  const respond = vi
    .spyOn(host.daemon.service.runtimeAuth, 'respondInteraction')
    .mockReturnValue(auth);
  for (const [path, body] of [
    ['/runtimes/codex/install', { command: 'arbitrary command' }],
    ['/runtimes/codex/auth/start', { command: 'arbitrary command' }],
    ['/runtimes/codex/install/cancel', {}],
    ['/runtimes/codex/auth/cancel', {}],
    ['/runtimes/codex/auth/respond', { flowId: 'fixture-flow', code: 'line\nline' }],
    ['/runtimes/codex/auth/start', { methodId: 'x'.repeat(101) }],
    ['/runtimes/codex/auth/logout', { command: 'arbitrary command' }],
    [
      '/runtimes/codex/auth/respond',
      {
        flowId: 'fixture-flow',
        interactionId: 'fixture-terminal',
        response: { type: 'terminal', data: 'x'.repeat(4097) },
      },
    ],
    [
      '/runtimes/codex/auth/respond',
      {
        flowId: 'fixture-flow',
        interactionId: 'fixture-terminal',
        response: { type: 'terminal', data: '', size: { cols: 0, rows: 24 } },
      },
    ],
  ] as const)
    expect((await host.request(path, 'POST', body)).response.status).toBe(400);
  expect((await host.request('/runtimes/demo/install', 'POST', {})).response.status).toBe(400);
  expect(configure).not.toHaveBeenCalled();
  expect(install).not.toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
  expect(logout).not.toHaveBeenCalled();
  expect(respond).not.toHaveBeenCalled();
  expect(
    (await host.request('/runtimes/codex/setup', 'PUT', { executable: null })).response.status,
  ).toBe(200);
  expect(configure).toHaveBeenCalledWith('codex', null);
  expect((await host.request('/runtimes/codex/install', 'POST', {})).response.status).toBe(202);
  expect(
    (await host.request('/runtimes/codex/install/cancel', 'POST', { operationId: 'fixture-op' }))
      .response.status,
  ).toBe(200);
  expect(cancel).toHaveBeenCalledWith('codex', 'fixture-op');
  expect(
    (await host.request('/runtimes/codex/auth/start', 'POST', { methodId: 'chatgpt' })).response
      .status,
  ).toBe(202);
  expect(start).toHaveBeenCalledWith('codex', 'chatgpt');
  expect((await host.request('/runtimes/codex/auth/logout', 'POST', {})).response.status).toBe(202);
  expect(logout).toHaveBeenCalledWith('codex');
  const input = { type: 'terminal', data: 'fixture-native-response\r' };
  expect(
    (
      await host.request('/runtimes/codex/auth/respond', 'POST', {
        flowId: 'fixture-flow',
        interactionId: 'fixture-terminal',
        response: input,
      })
    ).response.status,
  ).toBe(200);
  expect(respond).toHaveBeenCalledWith('codex', 'fixture-flow', 'fixture-terminal', input);
});
