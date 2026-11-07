import { EventEmitter } from 'node:events';
import type { WebContents } from 'electron';
import { afterEach, expect, test, vi } from 'vitest';
import { createNativeGroup } from '../src/browser/pages.ts';
import { runNativeBrowserCommand } from '../src/browser/commands.ts';
import { assertPublicUrl } from '../../mcp/src/computer/network.ts';

vi.mock('electron', () => ({
  shell: {},
  session: {
    fromPartition: () => ({
      setPermissionCheckHandler: vi.fn(),
      setPermissionRequestHandler: vi.fn(),
      webRequest: { onBeforeRequest: vi.fn() },
      on: vi.fn(),
    }),
  },
}));
vi.mock('../../mcp/src/computer/network.ts', () => ({ assertPublicUrl: vi.fn() }));
vi.mock('../src/browser/automation.ts', () => ({
  guestAutomation: () => ({ release: vi.fn(), send: vi.fn() }),
}));
vi.mock('../src/browser/manual.ts', () => ({ nativeManualFields: () => ({ begin: vi.fn() }) }));
vi.mock('../src/browser/capture.ts', () => ({ drainNativeCapture: vi.fn() }));
vi.mock('../src/browser/floating.ts', () => ({
  browserIsFloating: () => false,
  closeFloatingBrowser: vi.fn(),
}));

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((close) => close()));
  vi.resetAllMocks();
});
const fixture = async () => {
  let serial = 0;
  const guests = new Map<string, ReturnType<typeof guest>>();
  const guest = () => {
    const id = `tab-${++serial}`;
    let url = 'about:blank';
    let destroyed = false;
    const contents = Object.assign(new EventEmitter(), {
      id: serial,
      isDestroyed: () => destroyed,
      getURL: () => url,
      getTitle: () => '',
      isLoadingMainFrame: (): boolean => false,
      getZoomFactor: () => 1,
      isAudioMuted: () => false,
      isCurrentlyAudible: () => false,
      setWindowOpenHandler: vi.fn(),
      navigationHistory: { clear: vi.fn(), canGoBack: () => false, canGoForward: () => false },
      debugger: {
        attach: vi.fn(),
        sendCommand: vi.fn(async () => ({ targetInfo: { targetId: id } })),
      },
      reload: vi.fn(),
      stop: vi.fn(),
      reloadIgnoringCache: vi.fn(),
      loadURL: vi.fn(async (next: string) => {
        contents.emit('did-start-navigation', {}, next, false, true);
        url = next;
        contents.emit('did-navigate', {}, next);
      }),
      close: () => {
        destroyed = true;
        contents.emit('destroyed');
      },
    });
    guests.set(id, contents);
    return contents;
  };
  const group = createNativeGroup(
    'owner',
    'navigation-test',
    () => null,
    () => [group],
    {
      create: async () => guest() as unknown as WebContents,
      present: vi.fn(),
      forget: vi.fn(),
    } as unknown as Parameters<typeof createNativeGroup>[4],
  );
  cleanups.push(group.destroy);
  await group.create();
  group.manualUntil = Date.now() + 45000;
  const tab = () => group.state().tabs.find((tab) => tab.id === group.active)!;
  return { group, guests, tab };
};
const failedUrl = 'https://pitchcrew-browser-test.invalid/';
const dnsFailure = new Error('getaddrinfo ENOTFOUND pitchcrew-browser-test.invalid');

test('retains a preflight DNS failure across tab switching and retries the attempted URL until recovery', async () => {
  const { group, guests, tab } = await fixture();
  const first = group.active;
  vi.mocked(assertPublicUrl).mockRejectedValue(dnsFailure);
  await runNativeBrowserCommand(group, { kind: 'navigate', url: failedUrl });
  expect(tab()).toMatchObject({
    url: 'about:blank',
    navigationUrl: failedUrl,
    errorDetails: dnsFailure.message,
    error: expect.any(String),
  });
  expect(guests.get(first)!.loadURL).toHaveBeenCalledExactlyOnceWith('about:blank');
  await runNativeBrowserCommand(group, { kind: 'new-tab' });
  expect(tab().error).toBeUndefined();
  await runNativeBrowserCommand(group, { kind: 'select-tab', tabId: first });
  expect(tab().navigationUrl).toBe(failedUrl);
  for (const kind of ['reload', 'hard-reload'] as const) {
    await runNativeBrowserCommand(group, { kind });
    expect(assertPublicUrl).toHaveBeenLastCalledWith(failedUrl);
    expect(tab().error).toBeTruthy();
  }
  expect(assertPublicUrl).toHaveBeenCalledTimes(3);
  vi.mocked(assertPublicUrl).mockResolvedValue();
  await runNativeBrowserCommand(group, { kind: 'reload' });
  expect(guests.get(first)!.loadURL).toHaveBeenLastCalledWith(failedUrl);
  expect(tab()).toMatchObject({ url: failedUrl });
  expect(tab().navigationUrl).toBeUndefined();
  expect(tab().error).toBeUndefined();
  expect(tab().errorDetails).toBeUndefined();
});

test('records Chromium failures and clears them when a replacement address commits', async () => {
  const { group, guests, tab } = await fixture();
  const contents = guests.get(group.active)!;
  contents.emit('did-fail-load', {}, -105, 'ERR_NAME_NOT_RESOLVED', failedUrl, true);
  expect(tab()).toMatchObject({
    navigationUrl: failedUrl,
    errorDetails: 'ERR_NAME_NOT_RESOLVED (-105)',
  });
  contents.emit('did-fail-load', {}, -105, 'Subframe failure', 'https://example.com/frame', false);
  contents.emit('did-fail-load', {}, -3, 'ERR_ABORTED', 'https://example.com/aborted', true);
  contents.emit('did-navigate-in-page', {}, 'https://example.com/frame#anchor', false);
  expect(tab().navigationUrl).toBe(failedUrl);
  await runNativeBrowserCommand(group, { kind: 'navigate', url: 'https://example.com/recovery' });
  expect(tab()).toMatchObject({ url: 'https://example.com/recovery' });
  expect(tab().error).toBeUndefined();
  expect(tab().navigationUrl).toBeUndefined();
});

test('keeps validation and manual-control gates on navigation and retry', async () => {
  const { group, guests, tab } = await fixture();
  const contents = guests.get(group.active)!;
  vi.mocked(assertPublicUrl).mockRejectedValue(
    new Error('Local and private network access is blocked, including Pitchcrew itself.'),
  );
  await runNativeBrowserCommand(group, { kind: 'navigate', url: 'http://127.0.0.1/' });
  await runNativeBrowserCommand(group, { kind: 'reload' });
  expect(assertPublicUrl).toHaveBeenCalledTimes(2);
  expect(contents.loadURL).toHaveBeenCalledTimes(1);
  expect(tab().errorDetails).toContain('private network access is blocked');
  for (const url of ['file:///secret', 'https://user:password@example.com'])
    await expect(runNativeBrowserCommand(group, { kind: 'navigate', url })).rejects.toThrow(
      'public HTTP(S)',
    );
  group.manualUntil = 0;
  await expect(runNativeBrowserCommand(group, { kind: 'reload' })).rejects.toThrow(
    'control changed',
  );
  await expect(
    runNativeBrowserCommand(group, { kind: 'navigate', url: failedUrl }),
  ).rejects.toThrow('control changed');
  expect(contents.loadURL).toHaveBeenCalledTimes(1);
});

test('does not load after manual control expires during validation', async () => {
  const { group, guests } = await fixture();
  vi.mocked(assertPublicUrl).mockImplementation(async () => {
    group.manualUntil = 0;
  });
  await runNativeBrowserCommand(group, { kind: 'navigate', url: failedUrl });
  expect(guests.get(group.active)!.loadURL).toHaveBeenCalledTimes(1);
});

test('shows preflight as loading and stops without loading after DNS validation finishes', async () => {
  const { group, guests, tab } = await fixture();
  let finishValidation = () => {};
  vi.mocked(assertPublicUrl).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishValidation = resolve;
      }),
  );
  const navigation = runNativeBrowserCommand(group, { kind: 'navigate', url: failedUrl });
  const cancelled = expect(navigation).rejects.toThrow('ERR_ABORTED');
  await vi.waitFor(() => expect(tab().loading).toBe(true));
  await runNativeBrowserCommand(group, { kind: 'stop' });
  await cancelled;
  finishValidation();
  await Promise.resolve();
  expect(tab().loading).toBe(false);
  expect(guests.get(group.active)!.loadURL).toHaveBeenCalledTimes(1);
});

test.each(['resolve', 'reject'])(
  'returns at main-document commit while the full load remains pending, then %s',
  async (outcome) => {
    const { group, guests, tab } = await fixture();
    const contents = guests.get(group.active)!;
    const baseline = contents.listenerCount('did-navigate');
    let finish: () => void = () => {};
    let fail: (error: Error) => void = () => {};
    contents.loadURL.mockImplementationOnce(
      () =>
        new Promise<void>((resolve, reject) => {
          finish = resolve;
          fail = reject;
        }),
    );
    vi.spyOn(contents, 'isLoadingMainFrame').mockReturnValue(true);
    const navigation = runNativeBrowserCommand(group, { kind: 'navigate', url: failedUrl });
    await vi.waitFor(() => expect(contents.loadURL).toHaveBeenCalledWith(failedUrl));
    contents.emit('did-navigate', {}, failedUrl);
    await navigation;
    expect(tab().loading).toBe(true);
    expect(contents.listenerCount('did-navigate')).toBe(baseline);
    expect(contents.listenerCount('did-navigate-in-page')).toBe(1);
    await runNativeBrowserCommand(group, { kind: 'stop' });
    expect(contents.stop).toHaveBeenCalledOnce();
    if (outcome === 'resolve') finish();
    else {
      contents.emit('did-fail-load', {}, -101, 'ERR_CONNECTION_RESET', failedUrl, true);
      fail(new Error('ERR_CONNECTION_RESET'));
    }
    await Promise.resolve();
    if (outcome === 'reject') expect(tab().errorDetails).toBe('ERR_CONNECTION_RESET (-101)');
    else expect(tab().error).toBeUndefined();
  },
);

test('waits through subframe navigation and accepts a main-frame same-document commit', async () => {
  const { group, guests } = await fixture();
  const contents = guests.get(group.active)!;
  contents.loadURL.mockImplementationOnce(() => new Promise<void>(() => {}));
  let finished = false;
  const navigation = runNativeBrowserCommand(group, { kind: 'navigate', url: failedUrl }).then(
    () => {
      finished = true;
    },
  );
  await vi.waitFor(() => expect(contents.loadURL).toHaveBeenCalledWith(failedUrl));
  contents.emit('did-navigate-in-page', {}, 'https://example.com/frame#anchor', false);
  contents.emit('did-navigate-in-page', {}, 'https://example.com/old-page#anchor', true);
  await Promise.resolve();
  expect(finished).toBe(false);
  contents.emit('did-navigate-in-page', {}, failedUrl, true);
  await navigation;
  expect(contents.listenerCount('did-navigate')).toBe(1);
  expect(contents.listenerCount('did-navigate-in-page')).toBe(1);
});

test('removes commit listeners when a pending navigation is replaced or its tab closes', async () => {
  const { group, guests } = await fixture();
  const contents = guests.get(group.active)!;
  contents.loadURL.mockImplementationOnce(() => new Promise<void>(() => {}));
  const navigation = runNativeBrowserCommand(group, { kind: 'navigate', url: failedUrl });
  const cancelled = expect(navigation).rejects.toThrow('ERR_ABORTED');
  await vi.waitFor(() => expect(contents.loadURL).toHaveBeenCalledWith(failedUrl));
  await runNativeBrowserCommand(group, { kind: 'navigate', url: 'https://example.com/' });
  await cancelled;
  expect(contents.listenerCount('did-navigate')).toBe(1);
  expect(contents.listenerCount('did-navigate-in-page')).toBe(1);
  contents.loadURL.mockImplementationOnce(() => new Promise<void>(() => {}));
  const closing = runNativeBrowserCommand(group, { kind: 'navigate', url: failedUrl });
  await vi.waitFor(() => expect(contents.loadURL).toHaveBeenCalledTimes(4));
  await runNativeBrowserCommand(group, { kind: 'close-tab', tabId: group.active });
  await closing;
  expect(contents.listenerCount('did-navigate')).toBe(1);
  expect(contents.listenerCount('did-navigate-in-page')).toBe(1);
});

test.each(['resolve', 'reject'])(
  'allows tab switching and Stop when loadURL cancels by %s',
  async (outcome) => {
    const { group, guests } = await fixture();
    const first = group.active;
    const contents = guests.get(first)!;
    let cancel: (error: Error) => void = () => {};
    let finish: () => void = () => {};
    contents.loadURL.mockImplementationOnce(
      () =>
        new Promise<void>((resolve, reject) => {
          cancel = reject;
          finish = resolve;
        }),
    );
    contents.stop.mockImplementation(() =>
      outcome === 'resolve' ? finish() : cancel(new Error('ERR_ABORTED')),
    );
    const navigation = runNativeBrowserCommand(group, { kind: 'navigate', url: failedUrl });
    const cancelled = expect(navigation).rejects.toThrow('ERR_ABORTED');
    await vi.waitFor(() => expect(contents.loadURL).toHaveBeenCalledWith(failedUrl));
    await runNativeBrowserCommand(group, { kind: 'new-tab' });
    expect(group.active).not.toBe(first);
    await runNativeBrowserCommand(group, { kind: 'select-tab', tabId: first });
    await runNativeBrowserCommand(group, { kind: 'stop' });
    await cancelled;
  },
);
