import type { JobProvider } from '@pitchcrew/core';

export const userAgent =
  'Pitchcrew/0.1.0 (local job discovery; read-only; +https://github.com/HitBox38/PitchCrew)';
export const requestTimeoutMs = 20_000;
export const maxResponseBytes = 8 * 1024 * 1024;
export const providerIntervalMs = 1_000;

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Space requests to the same provider; different providers proceed independently. */
export class ProviderRateLimiter {
  private readonly next = new Map<JobProvider, Promise<void>>();
  constructor(private readonly intervalMs = providerIntervalMs) {}
  async schedule<T>(
    provider: JobProvider,
    task: () => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    const previous = this.next.get(provider) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    this.next.set(
      provider,
      previous.then(() => gate),
    );
    let started = false;
    let stopped: (() => void) | undefined;
    try {
      if (signal)
        await Promise.race([
          previous,
          new Promise<never>((_resolve, reject) => {
            stopped = () => reject(new Error('The scan was cancelled.'));
            if (signal.aborted) stopped();
            else signal.addEventListener('abort', stopped, { once: true });
          }),
        ]);
      else await previous;
      signal?.throwIfAborted();
      started = true;
      return await task();
    } finally {
      if (signal && stopped) signal.removeEventListener('abort', stopped);
      if (started) {
        const timer = setTimeout(release, this.intervalMs);
        timer.unref?.();
      } else release();
    }
  }
}

/** Rejects on abort even when an underlying stream ignores the signal. */
function abortPromise(signal: AbortSignal): Promise<never> {
  const promise = new Promise<never>((_resolve, reject) => {
    const fail = () => reject(new Error('The job board request was stopped.'));
    if (signal.aborted) fail();
    else signal.addEventListener('abort', fail, { once: true });
  });
  promise.catch(() => {});
  return promise;
}
async function readBounded(
  response: Response,
  signal: AbortSignal,
  maxBytes: number,
): Promise<string> {
  const declared = Number(response.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > maxBytes)
    throw new Error('The job board response is too large.');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const stopped = abortPromise(signal);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), stopped]);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('The job board response is too large.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** GET a fixed official endpoint: no credentials, no redirects, bounded time and size. */
export async function fetchBoard(
  fetcher: FetchLike,
  url: URL,
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    maxBytes?: number;
    /** Provider-specific messages for HTTP error statuses, such as a rejected Comeet token. */
    statusMessages?: Record<number, string>;
  } = {},
): Promise<unknown> {
  const { signal, maxBytes = maxResponseBytes } = options;
  const timeout = AbortSignal.timeout(options.timeoutMs ?? requestTimeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await Promise.race([
      fetcher(url.toString(), {
        method: 'GET',
        redirect: 'error',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { accept: 'application/json', 'user-agent': userAgent },
        signal: combined,
      }),
      abortPromise(combined),
    ]);
  } catch (error) {
    if (signal?.aborted) throw new Error('The scan was cancelled.');
    if (timeout.aborted) throw new Error('The job board request timed out.');
    throw new Error(
      `Could not reach the job board${error instanceof Error ? `: ${error.message}` : '.'}`,
    );
  }
  const custom = response.ok ? undefined : options.statusMessages?.[response.status];
  if (custom) {
    await response.body?.cancel().catch(() => {});
    throw new Error(custom);
  }
  if (response.status === 404) {
    await response.body?.cancel().catch(() => {});
    throw new Error('Job board not found. Check the provider and board name.');
  }
  if (response.status === 429) {
    await response.body?.cancel().catch(() => {});
    throw new Error('The job board is rate limiting requests. Try again later.');
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new Error(`The job board returned HTTP ${response.status}.`);
  }
  const type = response.headers.get('content-type') ?? '';
  if (!/\bjson\b/i.test(type)) {
    await response.body?.cancel().catch(() => {});
    throw new Error('The job board did not return JSON.');
  }
  let body: string;
  try {
    body = await readBounded(response, combined, maxBytes);
  } catch (error) {
    if (signal?.aborted) throw new Error('The scan was cancelled.');
    if (timeout.aborted) throw new Error('The job board request timed out.');
    throw error;
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error('The job board returned invalid JSON.');
  }
}
