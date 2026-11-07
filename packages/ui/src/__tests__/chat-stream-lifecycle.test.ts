import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readChatStream, subscribeChatStream } from '../chat-stream.ts';

const streams: (() => void)[] = [];
const encoder = new TextEncoder();
const stream = (cancel = vi.fn()) => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start: (value) => {
      controller = value;
    },
    cancel,
  });
  return { body, controller, cancel };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const stop of streams.splice(0)) stop();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('cancels a silent read after three missed heartbeats and releases its lock and timer', async () => {
  const { body, cancel } = stream();
  const onState = vi.fn();
  const reading = readChatStream(body, onState);
  await vi.advanceTimersByTimeAsync(44_999);
  expect(cancel).not.toHaveBeenCalled();
  expect(body.locked).toBe(true);
  await vi.advanceTimersByTimeAsync(1);
  await reading;
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(onState).not.toHaveBeenCalled();
  expect(body.locked).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it('heartbeats and partial received frames keep the stream alive without emitting extra states', async () => {
  const { body, controller, cancel } = stream();
  const onState = vi.fn();
  const reading = readChatStream(body, onState);
  for (let i = 0; i < 8; i++) {
    await vi.advanceTimersByTimeAsync(15_000);
    controller.enqueue(encoder.encode(': heartbeat\n\n'));
    await vi.advanceTimersByTimeAsync(0);
  }
  expect(cancel).not.toHaveBeenCalled();
  expect(onState).not.toHaveBeenCalled();
  controller.enqueue(encoder.encode('data: {"messages":[],"streamingMessages":[]}'));
  await vi.advanceTimersByTimeAsync(40_000);
  controller.enqueue(encoder.encode('\n\n'));
  await vi.advanceTimersByTimeAsync(40_000);
  expect(onState).toHaveBeenCalledTimes(1);
  expect(cancel).not.toHaveBeenCalled();
  controller.close();
  await reading;
  expect(body.locked).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it('explicit abort settles a hanging read even when the source cancel hook never settles', async () => {
  const cancel = vi.fn(() => new Promise<void>(() => {}));
  const { body } = stream(cancel);
  const controller = new AbortController();
  const reading = readChatStream(body, vi.fn(), controller.signal);
  controller.abort();
  await reading;
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(body.locked).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it('an already aborted subscription consumes no buffered states and releases the reader', async () => {
  const { body, controller, cancel } = stream();
  controller.enqueue(encoder.encode('data: {"messages":[],"streamingMessages":[]}\n\n'));
  const abort = new AbortController();
  abort.abort();
  const onState = vi.fn();
  await readChatStream(body, onState, abort.signal);
  expect(onState).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(body.locked).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it('silent subscription disconnects once, reconnects once and stops without retaining timers', async () => {
  const first = stream();
  const second = stream();
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(first.body))
    .mockResolvedValueOnce(new Response(second.body));
  vi.stubGlobal('fetch', fetch);
  const disconnected = vi.fn();
  const stop = subscribeChatStream(vi.fn(), disconnected);
  streams.push(stop);
  await vi.advanceTimersByTimeAsync(45_000);
  expect(first.cancel).toHaveBeenCalledTimes(1);
  expect(disconnected).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1000);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(disconnected).toHaveBeenCalledTimes(1);
  stop();
  await vi.advanceTimersByTimeAsync(100_000);
  expect(second.cancel).toHaveBeenCalledTimes(1);
  expect(first.body.locked).toBe(false);
  expect(second.body.locked).toBe(false);
  expect(disconnected).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it('stopping during the reconnect delay cancels that reconnect', async () => {
  const first = stream();
  const fetch = vi.fn().mockResolvedValue(new Response(first.body));
  vi.stubGlobal('fetch', fetch);
  const disconnected = vi.fn();
  const stop = subscribeChatStream(vi.fn(), disconnected);
  streams.push(stop);
  await vi.advanceTimersByTimeAsync(45_000);
  stop();
  await vi.advanceTimersByTimeAsync(1000);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(disconnected).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

const awaitHeaders = (signal: AbortSignal) =>
  new Promise<Response>((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
      once: true,
    });
  });

it('times out stalled headers without aborting the subscription and establishes exactly one retry', async () => {
  const connected = stream();
  const attempts: AbortSignal[] = [];
  const fetch = vi.fn((_url: string, init: RequestInit) => {
    attempts.push(init.signal!);
    return attempts.length === 1
      ? awaitHeaders(init.signal!)
      : Promise.resolve(new Response(connected.body));
  });
  vi.stubGlobal('fetch', fetch);
  const disconnected = vi.fn();
  const stop = subscribeChatStream(vi.fn(), disconnected);
  streams.push(stop);
  await vi.advanceTimersByTimeAsync(14_999);
  expect(attempts[0].aborted).toBe(false);
  expect(disconnected).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(attempts[0].aborted).toBe(true);
  expect(disconnected).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1000);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(attempts[1].aborted).toBe(false);
  expect(connected.body.locked).toBe(true);
  stop();
  await vi.advanceTimersByTimeAsync(100_000);
  expect(connected.cancel).toHaveBeenCalledTimes(1);
  expect(disconnected).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it('clears the header deadline after establishment so a healthy stream can run indefinitely', async () => {
  const connected = stream();
  let signal!: AbortSignal;
  const fetch = vi.fn((_url: string, init: RequestInit) => {
    signal = init.signal!;
    return Promise.resolve(new Response(connected.body));
  });
  vi.stubGlobal('fetch', fetch);
  const disconnected = vi.fn();
  const stop = subscribeChatStream(vi.fn(), disconnected);
  streams.push(stop);
  await vi.advanceTimersByTimeAsync(0);
  expect(vi.getTimerCount()).toBe(1); // Body inactivity only, no establishment timer.
  for (let i = 0; i < 8; i++) {
    await vi.advanceTimersByTimeAsync(15_000);
    connected.controller.enqueue(encoder.encode(': heartbeat\n\n'));
    await vi.advanceTimersByTimeAsync(0);
  }
  expect(signal.aborted).toBe(false);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(disconnected).not.toHaveBeenCalled();
  expect(connected.cancel).not.toHaveBeenCalled();
  stop();
  await vi.advanceTimersByTimeAsync(0);
  expect(vi.getTimerCount()).toBe(0);
});

it('stopping before headers aborts that fetch and suppresses timeout and reconnect', async () => {
  let signal!: AbortSignal;
  const fetch = vi.fn((_url: string, init: RequestInit) => {
    signal = init.signal!;
    return awaitHeaders(signal);
  });
  vi.stubGlobal('fetch', fetch);
  const disconnected = vi.fn();
  const stop = subscribeChatStream(vi.fn(), disconnected);
  streams.push(stop);
  stop();
  expect(signal.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(100_000);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(disconnected).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('disposes a rejected HTTP body without waiting for its cancel hook and clears its header deadline', async () => {
  const rejected = stream(vi.fn(() => new Promise<void>(() => {})));
  let signal!: AbortSignal;
  const fetch = vi.fn((_url: string, init: RequestInit) => {
    signal = init.signal!;
    return Promise.resolve(new Response(rejected.body, { status: 503 }));
  });
  vi.stubGlobal('fetch', fetch);
  const disconnected = vi.fn();
  const stop = subscribeChatStream(vi.fn(), disconnected);
  streams.push(stop);
  await vi.advanceTimersByTimeAsync(0);
  expect(rejected.cancel).toHaveBeenCalledTimes(1);
  expect(signal.aborted).toBe(true);
  expect(disconnected).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(1); // Reconnect only, no establishment timer.
  stop();
  await vi.advanceTimersByTimeAsync(100_000);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(disconnected).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
