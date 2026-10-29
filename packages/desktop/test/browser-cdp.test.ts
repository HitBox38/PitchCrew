import { captureNativePage } from '../src/browser/capture.ts';
import { EventEmitter } from 'node:events';
import type { WebContents } from 'electron';
import type { WebSocket } from 'ws';
import { expect, it, vi } from 'vitest';
import { connectBrowserRelay, type RelayGroup, type RelayPage } from '../src/browser/cdp.ts';
import { guestAutomation } from '../src/browser/automation.ts';

const fixture = () => {
  const events = Object.assign(new EventEmitter(), { sendCommand: vi.fn(async () => ({})) });
  const replies: Record<string, unknown>[] = [];
  const socket = Object.assign(new EventEmitter(), {
    readyState: 1,
    send: (raw: string) => replies.push(JSON.parse(raw)),
    close: vi.fn(),
  });
  const page: RelayPage = {
    id: 'guest-only',
    contents: Object.assign(new EventEmitter(), {
      debugger: events,
      getTitle: () => 'Guest',
      getURL: () => 'https://example.com',
      getUserAgent: () => 'Fixture',
      isDestroyed: () => false,
    }) as unknown as WebContents,
    send: vi.fn(async () => ({ ok: true })),
    releaseAutomation: vi.fn(),
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
  expect(page.send).toHaveBeenCalledWith(
    'Runtime.evaluate',
    { expression: '1' },
    undefined,
    expect.any(String),
  );
  expect(events.listenerCount('message')).toBe(1);
  relay.closed(page.id);
  expect(events.listenerCount('message')).toBe(0);
  socket.emit('close');
});
it('releases only the detached CDP session and drops all its holds when the relay closes', async () => {
  const { command, page, socket } = fixture();
  const first = (await command('Target.attachToTarget', { targetId: page.id })).result as {
    sessionId: string;
  };
  const second = (await command('Target.attachToTarget', { targetId: page.id })).result as {
    sessionId: string;
  };
  await command('Page.startScreencast', {}, first.sessionId);
  await command('Runtime.evaluate', {}, second.sessionId);
  const calls = vi.mocked(page.send).mock.calls;
  const firstOwner = calls[0]![3];
  const secondOwner = calls[1]![3];
  expect(firstOwner).not.toBe(secondOwner);
  await command('Target.detachFromTarget', { sessionId: first.sessionId });
  expect(page.releaseAutomation).toHaveBeenCalledExactlyOnceWith(firstOwner);
  socket.emit('close');
  expect(page.releaseAutomation).toHaveBeenLastCalledWith(secondOwner);
  expect(page.releaseAutomation).toHaveBeenCalledTimes(2);
});
it('releases child-frame ownership on native detach and cleans listeners before disconnect returns', async () => {
  const { command, page, events, relay } = fixture();
  await command('Target.setAutoAttach');
  events.emit('message', {}, 'Target.attachedToTarget', {
    sessionId: 'native-child',
    targetInfo: { type: 'iframe' },
  });
  await command('Page.startScreencast', {}, 'native-child');
  const owner = vi.mocked(page.send).mock.calls[0]![3];
  expect(page.send).toHaveBeenCalledWith('Page.startScreencast', {}, 'native-child', owner);
  events.emit('message', {}, 'Target.detachedFromTarget', { sessionId: 'native-child' });
  expect(page.releaseAutomation).toHaveBeenCalledExactlyOnceWith(owner);
  relay.disconnect();
  expect(events.listenerCount('message')).toBe(0);
});
it('fans page events out to every attached viewer and stops sending to a detached viewer', async () => {
  const { command, page, replies, events } = fixture();
  const first = (await command('Target.attachToTarget', { targetId: page.id })).result as {
    sessionId: string;
  };
  const second = (await command('Target.attachToTarget', { targetId: page.id })).result as {
    sessionId: string;
  };
  events.emit('message', {}, 'Page.screencastFrame', { data: 'first-frame' });
  expect(replies.filter((reply) => reply.method === 'Page.screencastFrame')).toEqual([
    { method: 'Page.screencastFrame', params: { data: 'first-frame' }, sessionId: first.sessionId },
    {
      method: 'Page.screencastFrame',
      params: { data: 'first-frame' },
      sessionId: second.sessionId,
    },
  ]);
  await command('Target.detachFromTarget', { sessionId: first.sessionId });
  replies.length = 0;
  events.emit('message', {}, 'Page.screencastFrame', { data: 'second-frame' });
  expect(replies).toEqual([
    {
      method: 'Page.screencastFrame',
      params: { data: 'second-frame' },
      sessionId: second.sessionId,
    },
  ]);
  await command('Target.detachFromTarget', { sessionId: second.sessionId });
  expect(events.listenerCount('message')).toBe(0);
});
it('keeps a crashed guest terminal and announces a fresh replacement without old child sessions', async () => {
  const { command, page, replies, events, relay, group } = fixture();
  await command('Target.setAutoAttach');
  const first = (
    replies.find((reply) => reply.method === 'Target.attachedToTarget')!.params as {
      sessionId: string;
    }
  ).sessionId;
  events.emit('message', {}, 'Target.attachedToTarget', {
    sessionId: 'old-iframe',
    targetInfo: { type: 'iframe' },
  });
  await command('Runtime.evaluate', {}, 'old-iframe');
  page.contents.emit('render-process-gone', {}, { reason: 'crashed' });
  expect(replies).toContainEqual({
    method: 'Target.detachedFromTarget',
    params: { sessionId: first, targetId: page.id },
  });
  expect(page.releaseAutomation).toHaveBeenCalledTimes(1);
  expect(await command('Runtime.evaluate', {}, first)).toHaveProperty('error');
  expect(await command('Runtime.evaluate', {}, 'old-iframe')).toHaveProperty('error');
  expect(await command('Target.attachToTarget', { targetId: page.id })).toHaveProperty('error');
  page.contents.emit('dom-ready');
  expect(
    replies.filter(
      (reply) =>
        reply.method === 'Target.attachedToTarget' &&
        (reply.params as { targetInfo?: { targetId?: string } }).targetInfo?.targetId === page.id,
    ),
  ).toHaveLength(1);
  relay.closed(page.id);
  group.pages.delete(page.id);
  const replacement: RelayPage = {
    ...page,
    id: 'fresh-replacement',
    contents: Object.assign(new EventEmitter(), {
      debugger: new EventEmitter(),
      getTitle: () => 'Recovered',
      getURL: () => 'https://example.com',
    }) as unknown as WebContents,
  };
  group.pages.set(replacement.id, replacement);
  relay.announce(replacement);
  const attached = replies.filter(
    (reply) =>
      reply.method === 'Target.attachedToTarget' &&
      ['guest-only', 'fresh-replacement'].includes(
        (reply.params as { targetInfo?: { targetId?: string } }).targetInfo?.targetId ?? '',
      ),
  );
  expect(attached).toHaveLength(2);
  const recovered = (attached[1]!.params as { sessionId: string }).sessionId;
  expect(recovered).not.toBe(first);
  await command('Runtime.evaluate', {}, recovered);
  relay.closed(replacement.id);
  expect(page.contents.listenerCount('render-process-gone')).toBe(0);
  expect(page.contents.listenerCount('dom-ready')).toBe(0);
});
it('waits for native tab teardown before acknowledging its close', async () => {
  const { command, group, replies, page } = fixture();
  let finish!: () => void;
  group.close = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const result = command('Target.closeTarget', { targetId: page.id });
  expect(group.close).toHaveBeenCalledExactlyOnceWith(page.id);
  await Promise.resolve();
  expect(replies).toEqual([]);
  finish();
  expect(await result).toMatchObject({ result: { success: true } });
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

it('captures a hidden native guest without the CDP screenshot command that stalls on Windows', async () => {
  const bytes = Buffer.from('fictional-masked-image');
  const nativeImage = {
    isEmpty: () => false,
    getSize: () => ({ width: 1280, height: 800 }),
    toJPEG: vi.fn(() => bytes),
    resize: vi.fn(),
  };
  const capturePage = vi.fn(async () => nativeImage);
  const sendCommand = vi.fn(async (method: string) =>
    method === 'Page.captureScreenshot' ? new Promise(() => {}) : {},
  );
  const events = new EventEmitter();
  const contents = Object.assign(events, {
    isDestroyed: () => false,
    executeJavaScriptInIsolatedWorld: vi.fn(async () => {}),
    capturePage,
    debugger: { sendCommand },
  }) as unknown as WebContents;
  const automation = guestAutomation(contents, vi.fn());
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      automation.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 40,
        clip: { x: 0, y: 0, width: 1280, height: 800, scale: 1 },
      }),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve('capture timed out'), 150);
      }),
    ]);
    expect(result).toEqual({ data: bytes.toString('base64') });
    expect(capturePage).toHaveBeenCalledWith(
      { x: 0, y: 0, width: 1280, height: 800 },
      { stayHidden: true, stayAwake: true },
    );
    expect(nativeImage.toJPEG).toHaveBeenCalledWith(40);
    expect(sendCommand.mock.calls.some(([method]) => method === 'Page.captureScreenshot')).toBe(
      false,
    );
  } finally {
    clearTimeout(timer);
    events.emit('destroyed');
  }
});

it('rejects empty, mismatched and excessive native captures instead of distorting evidence', async () => {
  const image = { isEmpty: () => false, getSize: () => ({ width: 700, height: 500 }) };
  const capturePage = vi.fn(async () => image);
  const contents = Object.assign(new EventEmitter(), {
    executeJavaScriptInIsolatedWorld: vi.fn(async () => {}),
    capturePage,
  }) as unknown as WebContents;
  await expect(
    captureNativePage(contents, { clip: { x: 0, y: 0, width: 1280, height: 800, scale: 1 } }),
  ).rejects.toThrow('viewport changed');
  image.isEmpty = () => true;
  await expect(captureNativePage(contents, {})).rejects.toThrow('empty image');
  capturePage.mockClear();
  await expect(
    captureNativePage(contents, { clip: { x: 0, y: 0, width: 10000, height: 10000, scale: 1 } }),
  ).rejects.toThrow('viewport limit');
  expect(capturePage).not.toHaveBeenCalled();
});
it('normalizes exact display backing pixels without accepting a changed viewport', async () => {
  const bytes = Buffer.from('retina-credential-masked-image');
  const normalized = { toJPEG: vi.fn(() => bytes) };
  const image = {
    isEmpty: () => false,
    getSize: () => ({ width: 2560, height: 1600 }),
    resize: vi.fn(() => normalized),
  };
  const contents = Object.assign(new EventEmitter(), {
    executeJavaScriptInIsolatedWorld: vi.fn(async () => {}),
    capturePage: vi.fn(async () => image),
  }) as unknown as WebContents;
  const params = {
    format: 'jpeg',
    quality: 40,
    clip: { x: 0, y: 0, width: 1280, height: 800, scale: 1 },
  };
  await expect(captureNativePage(contents, params, 2)).resolves.toEqual({
    data: bytes.toString('base64'),
  });
  expect(image.resize).toHaveBeenCalledWith({ width: 1280, height: 800 });
  expect(normalized.toJPEG).toHaveBeenCalledWith(40);
  await expect(captureNativePage(contents, params, 1)).rejects.toThrow('viewport changed');
});
it.each(['paint', 'capture'])(
  'bounds a stalled native %s and releases its timeout',
  async (phase) => {
    vi.useFakeTimers();
    try {
      const contents = Object.assign(new EventEmitter(), {
        executeJavaScriptInIsolatedWorld: vi.fn(() =>
          phase === 'paint' ? new Promise(() => {}) : Promise.resolve(),
        ),
        capturePage: vi.fn(() => new Promise(() => {})),
      }) as unknown as WebContents;
      const captured = captureNativePage(contents, {});
      const rejected = expect(captured).rejects.toThrow('Native browser capture timed out.');
      await vi.advanceTimersByTimeAsync(5000);
      await rejected;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  },
);

it('waits for the credential-mask paint before reading the native surface', async () => {
  let painted: (() => void) | undefined;
  const frame = new Promise<void>((resolve) => {
    painted = resolve;
  });
  const executeJavaScriptInIsolatedWorld = vi.fn(() => frame);
  const bytes = Buffer.from('masked-frame');
  const capturePage = vi.fn(async () => ({
    isEmpty: () => false,
    getSize: () => ({ width: 700, height: 500 }),
    toJPEG: () => bytes,
  }));
  const contents = Object.assign(new EventEmitter(), {
    executeJavaScriptInIsolatedWorld,
    capturePage,
  }) as unknown as WebContents;
  const result = captureNativePage(contents, {
    format: 'jpeg',
    clip: { x: 0, y: 0, width: 700, height: 500 },
  });
  const settled = expect(result).resolves.toEqual({ data: bytes.toString('base64') });
  try {
    await Promise.resolve();
    expect(capturePage).not.toHaveBeenCalled();
  } finally {
    painted!();
    await settled;
  }
  expect(executeJavaScriptInIsolatedWorld).toHaveBeenCalledWith(1001, [
    expect.objectContaining({ code: expect.stringContaining('requestAnimationFrame') }),
  ]);
});
