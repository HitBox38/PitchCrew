import {
  defaultCapabilities,
  type BrowserFrame,
  type Role,
  type Conversation,
} from '@pitchcrew/core';
import type { BrowserDriver } from '@pitchcrew/mcp/computer';
import { afterEach, expect, it, vi } from 'vitest';
import { setup, cleanup } from './helpers/daemon.ts';

type Listener = Parameters<NonNullable<BrowserDriver['subscribeFrames']>>[0];
const frame: BrowserFrame = {
  url: 'https://example.com',
  title: 'Fixture',
  width: 1280,
  height: 800,
  screenshot: 'aW1hZ2U=',
  status: 'live',
  generation: 1,
};
const controllers: AbortController[] = [];
afterEach(async () => {
  for (const controller of controllers.splice(0)) controller.abort();
  await cleanup();
});
const fixture = async (port: number) => {
  const listeners = new Set<Listener>();
  const stops = vi.fn();
  const driver = {
    snapshot: vi.fn(),
    frame: vi.fn(),
    perform: vi.fn(),
    close: vi.fn(async () => {}),
    subscribeFrames: vi.fn((receive: Listener) => {
      listeners.add(receive);
      receive(frame);
      return () => {
        listeners.delete(receive);
        stops();
      };
    }),
  };
  const host = await setup(port, false, { browserLaunch: async () => driver });
  const service = host.daemon.service;
  const role = service.board.get<Role>('role', 'writer');
  service.board.record(
    'role',
    { ...role, capabilities: { ...defaultCapabilities, ...role.capabilities, computerUse: true } },
    'user',
    'Enable fictional browser',
  );
  await service.computer.openBrowser('writer', 'writer', null);
  const connect = async (headers: Record<string, string> = {}) => {
    const controller = new AbortController();
    controllers.push(controller);
    const response = await fetch(`${host.daemon.url}/api/browser/writer/stream?threadId=writer`, {
      headers: { cookie: host.cookie, 'x-pitchcrew-client': 'ui', ...headers },
      signal: controller.signal,
    });
    return { response, controller };
  };
  return { ...host, service, driver, listeners, stops, connect };
};

it('streams push frames and heartbeats without polling and cleans up on viewer disconnect', async () => {
  const { connect, driver, listeners, stops } = await fixture(14527);
  const { response, controller } = await connect();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const reader = response.body!.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  expect(first).toContain('aW1hZ2U=');
  const received = reader.read();
  for (const receive of listeners) receive({ ...frame, title: 'New title' });
  expect(new TextDecoder().decode((await received).value)).toContain('New title');
  const heartbeat = new TextDecoder().decode((await reader.read()).value);
  expect(heartbeat).toContain('"heartbeat":true');
  expect(driver.frame).not.toHaveBeenCalled();
  expect(driver.snapshot).not.toHaveBeenCalled();
  controller.abort();
  await reader.cancel().catch(() => {});
  await vi.waitFor(() => expect(stops).toHaveBeenCalledOnce());
  expect(listeners.size).toBe(0);
});

it('rechecks capability revocation on a static page without waiting for another image', async () => {
  const { connect, service, stops } = await fixture(14528);
  const { response } = await connect();
  const reader = response.body!.getReader();
  await reader.read();
  const role = service.board.get<Role>('role', 'writer');
  service.board.record(
    'role',
    { ...role, capabilities: { ...defaultCapabilities, ...role.capabilities, computerUse: false } },
    'user',
    'Revoke fictional browser',
  );
  const next = await reader.read();
  expect(next.done).toBe(true);
  await vi.waitFor(() => expect(stops).toHaveBeenCalledOnce());
});

it('rejects conversation membership changes before forwarding another frame', async () => {
  const { connect, service, listeners, stops } = await fixture(14529);
  const { response } = await connect();
  const reader = response.body!.getReader();
  await reader.read();
  const conversation = service.board.get<Conversation>('conversation', 'writer');
  service.board.record(
    'conversation',
    { ...conversation, participants: ['scout'], leadId: 'scout' },
    'user',
    'Change fictional participants',
  );
  for (const receive of listeners) receive({ ...frame, screenshot: 'private-later-image' });
  const next = new TextDecoder().decode((await reader.read()).value);
  expect(next).not.toContain('private-later-image');
  expect(next).toContain('disconnected');
  await vi.waitFor(() => expect(stops).toHaveBeenCalledOnce());
});

it('requires the UI session and client header before subscribing', async () => {
  const { connect, driver } = await fixture(14530);
  expect((await connect({ cookie: '' })).response.status).toBe(403);
  expect((await connect({ 'x-pitchcrew-client': '' })).response.status).toBe(403);
  expect(driver.subscribeFrames).not.toHaveBeenCalled();
});
