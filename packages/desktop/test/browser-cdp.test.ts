import { EventEmitter } from 'node:events';
import type { WebContents } from 'electron';
import type { WebSocket } from 'ws';
import { expect, it, vi } from 'vitest';
import { connectBrowserRelay, type RelayGroup, type RelayPage } from '../src/browser/cdp.ts';
import { guestAutomation } from '../src/browser/automation.ts';

const fixture = () => {
  const events = new EventEmitter();
  const replies: Record<string, unknown>[] = [];
  const socket = Object.assign(new EventEmitter(), {
    readyState: 1,
    send: (raw: string) => replies.push(JSON.parse(raw)),
    close: vi.fn(),
  });
  const page: RelayPage = {
    id: 'guest-only',
    contents: {
      debugger: events,
      getTitle: () => 'Guest',
      getURL: () => 'https://example.com',
      getUserAgent: () => 'Fixture',
    } as unknown as WebContents,
    send: vi.fn(async () => ({ ok: true })),
  };
  const group: RelayGroup = {
    pages: new Map([[page.id, page]]),
    create: vi.fn(async () => page),
    close: vi.fn(),
  };
  const relay = connectBrowserRelay(group, socket as unknown as WebSocket);
  let sequence = 0;
  const command = async (
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string,
  ) => {
    const id = ++sequence;
    socket.emit('message', Buffer.from(JSON.stringify({ id, method, params, sessionId })));
    await vi.waitFor(() => expect(replies.some((reply) => reply.id === id)).toBe(true));
    return replies.find((reply) => reply.id === id)!;
  };
  return { events, replies, socket, page, group, relay, command };
};
it('exposes only job guest targets and rejects another window or unknown session', async () => {
  const { command, page } = fixture();
  expect(await command('Target.getTargets')).toMatchObject({
    result: { targetInfos: [{ targetId: 'guest-only' }] },
  });
  expect(await command('Target.attachToTarget', { targetId: 'app-window' })).toHaveProperty(
    'error',
  );
  expect(await command('Runtime.evaluate', {}, 'invented-session')).toHaveProperty('error');
  expect(page.send).not.toHaveBeenCalled();
});
it('routes the allowed page and detaches listeners when the connection closes', async () => {
  const { command, socket, page, events, replies, relay } = fixture();
  await command('Target.setAutoAttach');
  const attached = replies.find((reply) => reply.method === 'Target.attachedToTarget')!.params as {
    sessionId: string;
  };
  await command('Runtime.evaluate', { expression: '1' }, attached.sessionId);
  expect(page.send).toHaveBeenCalledWith('Runtime.evaluate', { expression: '1' });
  expect(events.listenerCount('message')).toBe(1);
  relay.closed(page.id);
  expect(events.listenerCount('message')).toBe(0);
  socket.emit('close');
});
it('blocks browser-global and target-discovery commands through page sessions', async () => {
  const events = new EventEmitter();
  const sendCommand = vi.fn(async () => ({}));
  const contents = Object.assign(events, {
    isDestroyed: () => false,
    debugger: { sendCommand },
  }) as unknown as WebContents;
  const automation = guestAutomation(contents, vi.fn());
  await expect(automation.send('Browser.getBrowserCommandLine', {})).rejects.toThrow(
    'other browser targets',
  );
  await expect(automation.send('Target.getTargets', {})).rejects.toThrow('other browser targets');
  expect(sendCommand).not.toHaveBeenCalled();
  events.emit('destroyed');
});

it('resolves JavaScript dialogs without waiting on focus emulation blocked by the modal', async () => {
  const contents = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    debugger: {
      sendCommand: vi.fn(async (method: string) => {
        if (method === 'Emulation.setFocusEmulationEnabled') return new Promise(() => {});
        return { resolved: true };
      }),
    },
  }) as unknown as WebContents;
  const automation = guestAutomation(contents, vi.fn());
  await expect(automation.send('Page.handleJavaScriptDialog', { accept: false })).resolves.toEqual({
    resolved: true,
  });
});
