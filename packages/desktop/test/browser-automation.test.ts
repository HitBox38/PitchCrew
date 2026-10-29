import { EventEmitter } from 'node:events';
import type { WebContents } from 'electron';
import { afterEach, expect, it, vi } from 'vitest';
import { guestAutomation } from '../src/browser/automation.ts';
import { captureNativePage, drainNativeCapture } from '../src/browser/capture.ts';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const image = () => ({
  isEmpty: () => false,
  getSize: () => ({ width: 640, height: 480 }),
  toPNG: () => Buffer.from('masked-native-page'),
});
const fixture = () => {
  const events = new EventEmitter();
  const sendCommand = vi.fn(async (_method: string, _params?: unknown) => ({}));
  const capturePage = vi.fn(async () => image());
  const contents = Object.assign(events, {
    isDestroyed: () => false,
    focusedFrame: {},
    isFocused: () => true,
    debugger: { sendCommand },
    executeJavaScriptInIsolatedWorld: vi.fn(async () => {}),
    capturePage,
  }) as unknown as WebContents;
  const paint = vi.fn();
  return {
    events,
    sendCommand,
    capturePage,
    contents,
    paint,
    automation: guestAutomation(contents, paint),
  };
};
afterEach(() => vi.useRealTimers());

it('keeps tab teardown behind an unfinished actual native copy after its caller times out', async () => {
  vi.useFakeTimers();
  const { contents, capturePage } = fixture();
  const copy = deferred<ReturnType<typeof image>>();
  capturePage.mockImplementationOnce(() => copy.promise);
  const capturing = captureNativePage(contents, {});
  const expired = expect(capturing).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(5000);
  await expired;
  let drained = false;
  const drain = drainNativeCapture(contents).then(() => {
    drained = true;
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(drained).toBe(false);
  copy.resolve(image());
  await drain;
  expect(drained).toBe(true);
});

it('releases an abandoned command without undercounting another owner when it finally settles', async () => {
  vi.useFakeTimers();
  const { automation, sendCommand, events } = fixture();
  const abandoned = deferred<object>();
  const current = deferred<object>();
  sendCommand.mockImplementation((method) => {
    if (method === 'Runtime.evaluate') return abandoned.promise;
    if (method === 'Input.dispatchMouseEvent') return current.promise;
    return Promise.resolve({});
  });
  const first = automation.send('Runtime.evaluate', {}, undefined, 'closed-owner');
  await vi.advanceTimersByTimeAsync(0);
  expect(automation.active).toBe(true);
  automation.release('closed-owner');
  expect(automation.active).toBe(false);
  const second = automation.send('Input.dispatchMouseEvent', {}, undefined, 'live-owner');
  await vi.advanceTimersByTimeAsync(0);
  abandoned.resolve({});
  await first;
  expect(automation.active).toBe(true);
  current.resolve({});
  await second;
  await vi.advanceTimersByTimeAsync(300);
  expect(automation.active).toBe(false);
  events.emit('destroyed');
});

it('keeps an acknowledged key event authorized until Chromium delivers it and revokes it on release', async () => {
  vi.useFakeTimers();
  const { automation, paint, events } = fixture();
  await automation.send(
    'Input.dispatchKeyEvent',
    { type: 'keyDown', key: 'Enter' },
    undefined,
    'agent',
  );
  expect(automation.active).toBe(true);
  expect(paint).toHaveBeenLastCalledWith(true);
  await vi.advanceTimersByTimeAsync(299);
  expect(automation.active).toBe(true);
  await vi.advanceTimersByTimeAsync(1);
  expect(automation.active).toBe(false);
  expect(paint).toHaveBeenLastCalledWith(false);
  await automation.send(
    'Input.dispatchKeyEvent',
    { type: 'keyUp', key: 'Enter' },
    undefined,
    'agent',
  );
  automation.release('agent');
  expect(automation.active).toBe(false);
  events.emit('destroyed');
});

it('keeps another viewer painting when one streaming owner stops or disconnects', async () => {
  vi.useFakeTimers();
  const { automation, paint, events, sendCommand } = fixture();
  await automation.send('Page.startScreencast', {}, undefined, 'viewer-a');
  await automation.send('Page.startScreencast', {}, undefined, 'viewer-b');
  await automation.send('Page.stopScreencast', {}, undefined, 'viewer-a');
  expect(
    sendCommand.mock.calls.filter(([method]) => method === 'Page.startScreencast'),
  ).toHaveLength(1);
  expect(
    sendCommand.mock.calls.filter(([method]) => method === 'Page.stopScreencast'),
  ).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(300);
  expect(paint).toHaveBeenLastCalledWith(true);
  automation.release('viewer-a');
  expect(paint).toHaveBeenLastCalledWith(true);
  automation.release('viewer-b');
  expect(paint).toHaveBeenLastCalledWith(false);
  expect(sendCommand).toHaveBeenLastCalledWith('Page.stopScreencast', {}, undefined);
  events.emit('destroyed');
});

it('drops old-document holds on navigation while preserving a viewer stream', async () => {
  vi.useFakeTimers();
  const { automation, sendCommand, events, paint } = fixture();
  await automation.send('Page.startScreencast', {}, undefined, 'viewer');
  const pending = deferred<object>();
  sendCommand.mockImplementation((method) =>
    method === 'Runtime.evaluate' ? pending.promise : Promise.resolve({}),
  );
  const operation = automation.send('Runtime.evaluate', {}, undefined, 'agent');
  await vi.advanceTimersByTimeAsync(0);
  events.emit('did-start-navigation', {}, 'https://example.com/next', false, true);
  expect(automation.active).toBe(false);
  expect(paint).toHaveBeenLastCalledWith(true);
  automation.release('viewer');
  await vi.advanceTimersByTimeAsync(300);
  expect(sendCommand).toHaveBeenLastCalledWith('Emulation.setFocusEmulationEnabled', {
    enabled: false,
  });
  pending.resolve({});
  await operation;
  events.emit('destroyed');
});

it('does not read a native surface after its capture owner was released during mask painting', async () => {
  vi.useFakeTimers();
  const { automation, contents, capturePage, events } = fixture();
  const painting = deferred<void>();
  vi.mocked(contents.executeJavaScriptInIsolatedWorld).mockReturnValue(painting.promise);
  const operation = automation.send('Page.captureScreenshot', {}, undefined, 'agent');
  const rejected = expect(operation).rejects.toThrow('page this capture was for has changed');
  await vi.advanceTimersByTimeAsync(0);
  automation.release('agent');
  painting.resolve();
  await rejected;
  expect(capturePage).not.toHaveBeenCalled();
  events.emit('destroyed');
});

it('serializes the actual native copies after a caller timeout and skips expired queued captures', async () => {
  vi.useFakeTimers();
  const { contents, capturePage, events } = fixture();
  const copying = deferred<ReturnType<typeof image>>();
  capturePage.mockReturnValueOnce(copying.promise);
  const first = captureNativePage(contents, {});
  const firstTimeout = expect(first).rejects.toThrow('timed out');
  const second = captureNativePage(contents, {});
  const secondTimeout = expect(second).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(0);
  expect(capturePage).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(5000);
  await Promise.all([firstTimeout, secondTimeout]);
  const third = captureNativePage(contents, {});
  await vi.advanceTimersByTimeAsync(0);
  expect(capturePage).toHaveBeenCalledTimes(1);
  copying.resolve(image());
  await expect(third).resolves.toEqual({
    data: Buffer.from('masked-native-page').toString('base64'),
  });
  expect(capturePage).toHaveBeenCalledTimes(2);
  expect(contents.executeJavaScriptInIsolatedWorld).toHaveBeenCalledTimes(2);
  events.emit('destroyed');
});

it.each(['render-process-gone', 'did-navigate'])(
  'does not inherit a previous renderer capture after %s and rejects its stale result',
  async (event) => {
    vi.useFakeTimers();
    const { contents, capturePage, events } = fixture();
    const oldCopy = deferred<ReturnType<typeof image>>();
    capturePage.mockReturnValueOnce(oldCopy.promise);
    const first = captureNativePage(contents, {});
    const stale = expect(first).rejects.toThrow('page this capture was for has changed');
    await vi.advanceTimersByTimeAsync(0);
    expect(capturePage).toHaveBeenCalledTimes(1);
    events.emit(event);
    const recovered = captureNativePage(contents, {});
    await expect(recovered).resolves.toEqual({
      data: Buffer.from('masked-native-page').toString('base64'),
    });
    expect(capturePage).toHaveBeenCalledTimes(2);
    oldCopy.resolve(image());
    await stale;
    expect(contents.listenerCount('did-navigate')).toBe(1);
    events.emit('destroyed');
    expect(contents.listenerCount('did-navigate')).toBe(0);
  },
);
