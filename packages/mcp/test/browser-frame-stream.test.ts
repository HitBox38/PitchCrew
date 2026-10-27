import type { BrowserFrame } from '@pitchcrew/core';
import type { Page, Disposable } from 'playwright';
import { afterEach, expect, it, vi } from 'vitest';
import { browserFrameStream } from '../src/computer/frame-stream.ts';
import { latestFrames } from '../src/computer/frame-queue.ts';
import type { BrowserFrameEvent } from '../src/computer/types.ts';

const base: BrowserFrame = {
  screenshot: 'aW1hZ2U=',
  width: 1280,
  height: 800,
  url: 'https://example.com/a',
  title: 'A',
};
type Options = NonNullable<Parameters<Page['screencast']['start']>[0]>;
const resources: (() => Promise<void>)[] = [];
const fixture = (screencast = true) => {
  let metadata: Omit<BrowserFrame, 'screenshot'> = { ...base };
  const captures: { options: Options; dispose: ReturnType<typeof vi.fn> }[] = [];
  const page = {
    isClosed: () => false,
    title: vi.fn(async () => metadata.title),
    screencast: {
      start: vi.fn(async (options: Options): Promise<Disposable> => {
        const dispose = vi.fn(async () => {});
        captures.push({ options, dispose });
        return { dispose, [Symbol.asyncDispose]: dispose };
      }),
    },
  };
  const capture = vi.fn(async () => ({ ...base }));
  const stream = browserFrameStream({
    page: () => page as unknown as Page,
    metadata: () => metadata,
    capture,
    screencast,
  });
  resources.push(stream.close);
  const emit = (index = captures.length - 1, text = 'image', width = 1280, height = 800) =>
    captures[index].options.onFrame!({
      data: Buffer.from(text),
      timestamp: Date.now(),
      viewportWidth: width,
      viewportHeight: height,
    });
  return {
    stream,
    page,
    captures,
    capture,
    emit,
    change: (value: Partial<typeof metadata>) => {
      metadata = { ...metadata, ...value };
    },
  };
};
afterEach(async () => {
  for (const close of resources.splice(0)) await close();
  vi.useRealTimers();
});

it('shares one capture between viewers and releases it after the last viewer leaves', async () => {
  const { stream, page, captures, capture, emit } = fixture();
  const first = vi.fn();
  const second = vi.fn();
  const stop = stream.subscribe(first);
  const stopSecond = stream.subscribe(second);
  await vi.waitFor(() => expect(captures).toHaveLength(1));
  emit();
  expect(first).toHaveBeenLastCalledWith(
    expect.objectContaining({
      status: 'live',
      screenshot: Buffer.from('image').toString('base64'),
    }),
  );
  expect(second).toHaveBeenLastCalledWith(first.mock.lastCall![0]);
  expect(capture).not.toHaveBeenCalled();
  stop();
  expect(captures[0].dispose).not.toHaveBeenCalled();
  stopSecond();
  await vi.waitFor(() => expect(captures[0].dispose).toHaveBeenCalledOnce());
  const calls = second.mock.calls.length;
  emit();
  expect(second).toHaveBeenCalledTimes(calls);
  const stopThird = stream.subscribe(second);
  await vi.waitFor(() => expect(page.screencast.start).toHaveBeenCalledTimes(2));
  stopThird();
});

it('discards old-page frames and old geometry across page or viewport changes', async () => {
  const { stream, captures, change, emit } = fixture();
  const receive = vi.fn();
  stream.subscribe(receive);
  await vi.waitFor(() => expect(captures).toHaveLength(1));
  emit();
  const generation = stream.generation;
  change({ width: 390, height: 920, url: 'https://example.com/b' });
  stream.reset();
  expect(receive).toHaveBeenLastCalledWith(
    expect.objectContaining({
      generation: generation + 1,
      status: 'loading',
      screenshot: '',
      width: 390,
    }),
  );
  const calls = receive.mock.calls.length;
  emit(0, 'old-page');
  expect(receive).toHaveBeenCalledTimes(calls);
  await vi.waitFor(() => expect(captures).toHaveLength(2));
  emit(1, 'wrong-size');
  expect(receive).toHaveBeenCalledTimes(calls);
  emit(1, 'new-page', 390, 920);
  expect(receive).toHaveBeenLastCalledWith(
    expect.objectContaining({
      screenshot: Buffer.from('new-page').toString('base64'),
      url: 'https://example.com/b',
      generation: generation + 1,
    }),
  );
});

it('publishes and removes dialog/warning metadata without needing another image', async () => {
  const { stream, captures, change, emit } = fixture();
  const receive = vi.fn();
  stream.subscribe(receive);
  await vi.waitFor(() => expect(captures).toHaveLength(1));
  emit();
  change({ dialog: { type: 'alert', message: 'Confirm' }, warning: 'Needs approval' });
  stream.refresh();
  expect(receive).toHaveBeenLastCalledWith(
    expect.objectContaining({
      dialog: { type: 'alert', message: 'Confirm' },
      warning: 'Needs approval',
      status: 'live',
    }),
  );
  change({ dialog: undefined, warning: undefined });
  stream.refresh();
  expect(receive.mock.lastCall![0].dialog).toBeUndefined();
  expect(receive.mock.lastCall![0].warning).toBeUndefined();
});

it('falls back to one bounded polling source when screencast startup fails', async () => {
  const { stream, page, capture } = fixture();
  page.screencast.start.mockRejectedValueOnce(new Error('Unsupported capture'));
  const first = vi.fn();
  const second = vi.fn();
  stream.subscribe(first);
  stream.subscribe(second);
  await vi.waitFor(() => expect(capture).toHaveBeenCalledOnce());
  expect(first).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'fallback' }));
  expect(second).toHaveBeenLastCalledWith(first.mock.lastCall![0]);
});

it('falls back if startup produces no first frame and stops all capture timers on close', async () => {
  const { stream, capture, captures } = fixture();
  vi.useFakeTimers();
  stream.subscribe(vi.fn());
  await vi.advanceTimersByTimeAsync(1501);
  expect(capture).toHaveBeenCalledOnce();
  expect(captures[0].dispose).toHaveBeenCalledOnce();
  await stream.close();
  const count = capture.mock.calls.length;
  await vi.advanceTimersByTimeAsync(5000);
  expect(capture).toHaveBeenCalledTimes(count);
});

it('does not leak a screencast that finishes starting after the viewer disconnects', async () => {
  const { stream, page } = fixture();
  let finish!: (value: Awaited<ReturnType<Page['screencast']['start']>>) => void;
  const dispose = vi.fn(async () => {});
  page.screencast.start.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const stop = stream.subscribe(vi.fn());
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  stop();
  finish({ dispose, [Symbol.asyncDispose]: dispose });
  await stream.close();
  expect(dispose).toHaveBeenCalledOnce();
});

it('retains only the latest pending frame for slow consumers and preserves terminal errors', async () => {
  const controller = new AbortController();
  const queue = latestFrames(controller.signal);
  for (let i = 0; i < 1000; i++) queue.push({ ...base, title: `${i}` });
  expect(await queue.next()).toMatchObject({ title: '999' });
  queue.push({ error: 'Closed' });
  queue.push(base);
  expect(await queue.next()).toEqual({ error: 'Closed' });
  const pending = queue.next();
  controller.abort();
  expect(await pending).toBeUndefined();
  queue.close();
});

it('does not forward an oversized image to viewers', async () => {
  const { stream, captures } = fixture();
  const events: BrowserFrameEvent[] = [];
  stream.subscribe((event) => events.push(event));
  await vi.waitFor(() => expect(captures).toHaveLength(1));
  captures[0].options.onFrame!({
    data: Buffer.alloc(1_400_000),
    timestamp: Date.now(),
    viewportWidth: 1280,
    viewportHeight: 800,
  });
  await vi.waitFor(() =>
    expect(events.some((event) => !('error' in event) && event.status === 'fallback')).toBe(true),
  );
  expect(events.every((event) => 'error' in event || event.screenshot.length < 2_000_000)).toBe(
    true,
  );
});

it('supports explicit screenshot fallback without starting a screencast', async () => {
  const { stream, page, capture } = fixture(false);
  const receive = vi.fn();
  stream.subscribe(receive);
  await vi.waitFor(() => expect(capture).toHaveBeenCalledOnce());
  expect(page.screencast.start).not.toHaveBeenCalled();
  expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'fallback' }));
});
