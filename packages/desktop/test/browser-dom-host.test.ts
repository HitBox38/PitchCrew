import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BrowserWindow, WebPreferences } from 'electron';
import type { DesktopBrowserView } from '../../core/src/native-browser.ts';
import { createDomBrowserHost } from '../src/browser/dom-host.ts';
import { domBrowserBootstrapUrl, domBrowserChannels } from '../src/browser/dom-protocol.ts';

const mock = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  partitions: new Map<string, object>(),
}));
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
      mock.handlers.set(channel, handler),
    removeHandler: (channel: string) => mock.handlers.delete(channel),
  },
  session: {
    fromPartition: (partition: string) => {
      if (!mock.partitions.has(partition)) mock.partitions.set(partition, {});
      return mock.partitions.get(partition);
    },
  },
}));

const partition = `persist:pitchcrew-browser-${'a'.repeat(64)}`;
const origin = 'http://127.0.0.1:4417';
const closers: (() => void)[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const close of closers.splice(0)) close();
  vi.useRealTimers();
  mock.handlers.clear();
  mock.partitions.clear();
});

const fixture = () => {
  const frame = { url: `${origin}/chat/writer`, send: vi.fn() };
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: frame,
    isDestroyed: () => false,
  });
  const window = Object.assign(new EventEmitter(), {
    webContents: contents,
    isDestroyed: () => false,
  });
  const host = createDomBrowserHost(
    () => window as unknown as BrowserWindow,
    () => origin,
  );
  host.install(window as unknown as BrowserWindow);
  closers.push(host.close);
  const trusted = { sender: contents, senderFrame: frame };
  const call = (channel: string, ...args: unknown[]) =>
    mock.handlers.get(channel)!(trusted, ...args);
  const views = () => call(domBrowserChannels.views) as DesktopBrowserView[];
  let serial = 10;
  const guest = (token: string, selectedPartition = partition) => {
    if (!mock.partitions.has(selectedPartition)) mock.partitions.set(selectedPartition, {});
    let destroyed = false;
    let url = domBrowserBootstrapUrl(token);
    const value = Object.assign(new EventEmitter(), {
      id: ++serial,
      getType: () => 'webview',
      hostWebContents: contents,
      session: mock.partitions.get(selectedPartition),
      getURL: () => url,
      isDestroyed: () => destroyed,
      close: vi.fn(() => {
        destroyed = true;
        value.emit('destroyed');
      }),
    });
    return {
      value,
      navigate: (next: string) => {
        url = next;
        value.emit('did-start-navigation', {}, next, false, true);
      },
    };
  };
  const permit = (token: string, selectedPartition = partition) => {
    const event = { preventDefault: vi.fn() };
    const preferences: WebPreferences = {
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      nodeIntegrationInSubFrames: true,
      sandbox: false,
      contextIsolation: false,
      webSecurity: false,
      webviewTag: true,
      preload: '/untrusted/preload.js',
      additionalArguments: ['--untrusted'],
    };
    contents.emit('will-attach-webview', event, preferences, {
      src: domBrowserBootstrapUrl(token),
      partition: selectedPartition,
    });
    return { event, preferences };
  };
  const attach = (token: string) => {
    permit(token);
    const created = guest(token);
    contents.emit('did-attach-webview', {}, created.value);
    created.navigate(domBrowserBootstrapUrl(token));
    return created;
  };
  return { host, contents, window, frame, trusted, call, views, guest, permit, attach };
};

it('creates one hardened guest and publishes presentation without navigation or replacement', async () => {
  const { host, frame, call, views, attach } = fixture();
  const pending = host.create(partition);
  const { token } = views()[0];
  expect(views()).toEqual([{ token, partition, bounds: null, painting: false, manual: false }]);
  const { value, navigate } = attach(token);
  call(domBrowserChannels.register, token, value.id);
  expect(await pending).toBe(value);
  navigate('https://example.com/apply');
  expect(() => call(domBrowserChannels.register, token, value.id)).not.toThrow();
  const bounds = { x: 30, y: 70, width: 700, height: 500 };
  frame.send.mockClear();
  host.present(value.id, bounds, true, true);
  expect(views()[0]).toMatchObject({ contentsId: value.id, bounds, painting: true, manual: true });
  host.present(value.id, bounds, true, true);
  expect(frame.send).toHaveBeenCalledTimes(1);
  expect(value.close).not.toHaveBeenCalled();
  host.forget(value.id);
  expect(views()).toEqual([]);
  expect(value.close).not.toHaveBeenCalled();
});

it('rejects foreign frames, guest senders and untrusted app origins for every IPC', async () => {
  const { host, trusted, frame } = fixture();
  for (const channel of [domBrowserChannels.views, domBrowserChannels.register]) {
    const invoke = mock.handlers.get(channel)!;
    expect(() => invoke({ ...trusted, senderFrame: { url: frame.url } })).toThrow('unavailable');
    expect(() => invoke({ ...trusted, sender: {} })).toThrow('unavailable');
    expect(() => invoke({ ...trusted, senderFrame: null })).toThrow('unavailable');
    frame.url = 'https://example.com';
    expect(() => invoke(trusted)).toThrow('unavailable');
    frame.url = `${origin}/chat/writer`;
  }
  frame.url = 'https://example.com';
  await expect(host.create(partition)).rejects.toThrow('unavailable');
  frame.url = `${origin}/chat/writer`;
  await expect(host.create('persist:other')).rejects.toThrow('unavailable');
});

it('requires a one-shot bootstrap nonce and exact partition and removes guest privileges', async () => {
  const { host, contents, views, permit } = fixture();
  const pending = host.create(partition);
  const rejected = expect(pending).rejects.toThrow('reloaded');
  const { token } = views()[0];
  expect(permit('unknown').event.preventDefault).toHaveBeenCalled();
  expect(
    permit(token, `persist:pitchcrew-browser-${'b'.repeat(64)}`).event.preventDefault,
  ).toHaveBeenCalled();
  const remote = { preventDefault: vi.fn() };
  contents.emit('will-attach-webview', remote, {}, { src: 'https://example.com', partition });
  expect(remote.preventDefault).toHaveBeenCalled();
  const { preferences, event } = permit(token);
  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(preferences).toMatchObject({
    sandbox: true,
    contextIsolation: true,
    webSecurity: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    webviewTag: false,
    partition,
  });
  expect(preferences.preload).toBeUndefined();
  expect(preferences.additionalArguments).toBeUndefined();
  expect(permit(token).event.preventDefault).toHaveBeenCalled();
  host.close();
  await rejected;
});

it('keeps concurrent requests on the same partition bound to their own actual guest', async () => {
  const { host, views, call, attach, contents } = fixture();
  const first = host.create(partition);
  const second = host.create(partition);
  const [one, two] = views();
  const oneGuest = attach(one.token);
  const twoGuest = attach(two.token);
  expect(() => call(domBrowserChannels.register, one.token, twoGuest.value.id)).toThrow(
    'not owned',
  );
  expect(() => call(domBrowserChannels.register, two.token, oneGuest.value.id)).toThrow(
    'not owned',
  );
  expect(() => call(domBrowserChannels.register, one.token, 999)).toThrow('not owned');
  expect(() => call(domBrowserChannels.register, one.token, 1.5)).toThrow();
  call(domBrowserChannels.register, two.token, twoGuest.value.id);
  call(domBrowserChannels.register, one.token, oneGuest.value.id);
  expect(await first).toBe(oneGuest.value);
  expect(await second).toBe(twoGuest.value);
  expect(oneGuest.value.close).not.toHaveBeenCalled();
  expect(twoGuest.value.close).not.toHaveBeenCalled();
  contents.emit('did-start-navigation', {}, `${origin}/chat/reviewer`, true, true);
  expect(views()).toHaveLength(2);
});

it('binds a captured guest whose bootstrap navigation committed before did-attach', async () => {
  const { host, views, permit, guest, contents, call } = fixture();
  const pending = host.create(partition);
  const { token } = views()[0];
  permit(token);
  const created = guest(token);
  contents.emit('did-attach-webview', {}, created.value);
  call(domBrowserChannels.register, token, created.value.id);
  expect(await pending).toBe(created.value);
});

it('closes foreign guests and rejects bootstrap navigation away before registration', async () => {
  const { host, contents, views, permit, guest, attach, call } = fixture();
  const pending = host.create(partition);
  const rejected = expect(pending).rejects.toThrow('bootstrap changed');
  const { token } = views()[0];
  const foreign = guest(token);
  foreign.value.hostWebContents = Object.assign(new EventEmitter(), {
    mainFrame: { url: 'https://example.com', send: vi.fn() },
    isDestroyed: () => false,
  });
  contents.emit('did-attach-webview', {}, foreign.value);
  expect(foreign.value.close).toHaveBeenCalledOnce();
  const created = attach(token);
  const nested = { preventDefault: vi.fn() };
  created.value.emit('will-attach-webview', nested);
  expect(nested.preventDefault).toHaveBeenCalledOnce();
  created.navigate('https://example.com');
  await rejected;
  expect(created.value.close).toHaveBeenCalledOnce();
  expect(() => call(domBrowserChannels.register, token, created.value.id)).toThrow('not owned');
  expect(views()).toEqual([]);
  expect(permit(token).event.preventDefault).toHaveBeenCalled();
});

it('times out pending requests and closes late attached guests', async () => {
  const { host, views, permit, guest, contents, call } = fixture();
  const pending = host.create(partition);
  const rejected = expect(pending).rejects.toThrow('did not attach in time');
  const { token } = views()[0];
  permit(token);
  await vi.advanceTimersByTimeAsync(10000);
  await rejected;
  expect(views()).toEqual([]);
  const late = guest(token);
  contents.emit('did-attach-webview', {}, late.value);
  expect(late.value.close).toHaveBeenCalledOnce();
  expect(() => call(domBrowserChannels.register, token, late.value.id)).toThrow('not owned');
});

it('rejects pending work and closes registered guests on a renderer reload and removes IPC on close', async () => {
  const { host, views, attach, call, contents } = fixture();
  const ready = host.create(partition);
  const { token } = views()[0];
  const guest = attach(token);
  call(domBrowserChannels.register, token, guest.value.id);
  expect(await ready).toBe(guest.value);
  const pending = host.create(partition);
  const rejected = expect(pending).rejects.toThrow('reloaded');
  contents.emit('did-start-navigation', {}, `${origin}/chat/writer`, false, true);
  await rejected;
  expect(guest.value.close).toHaveBeenCalledOnce();
  expect(views()).toEqual([]);
  host.close();
  expect(mock.handlers.size).toBe(0);
  expect(contents.listenerCount('will-attach-webview')).toBe(0);
  expect(contents.listenerCount('did-attach-webview')).toBe(0);
  await expect(host.create(partition)).rejects.toThrow('unavailable');
});
