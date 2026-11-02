import { afterEach, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => vi.fn());
vi.mock('../../api.ts', () => ({ api: request }));

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetModules();
  request.mockReset();
});

const config = { token: 'phc_fixture123', host: 'https://eu.i.posthog.com' };

it('can recover from a failed config request without reloading the renderer', async () => {
  const { loadAnalyticsConfig, useAnalyticsConfig } = await import('../api.ts');
  request.mockRejectedValueOnce(new Error('Daemon restarting')).mockResolvedValueOnce(config);
  expect(await loadAnalyticsConfig()).toBe(false);
  expect(useAnalyticsConfig.getState()).toEqual({ config: null, loaded: false });
  expect(await loadAnalyticsConfig()).toBe(true);
  expect(request).toHaveBeenCalledTimes(2);
  expect(useAnalyticsConfig.getState()).toEqual({ config, loaded: true });
});

it.each([config, null])(
  'shares pending discovery and caches a successful response: %j',
  async (value) => {
    const { loadAnalyticsConfig, startAnalyticsConfigLoading, useAnalyticsConfig } =
      await import('../api.ts');
    vi.useFakeTimers();
    let resolve!: (value: typeof config | null) => void;
    request.mockImplementationOnce(
      () =>
        new Promise<typeof config | null>((done) => {
          resolve = done;
        }),
    );
    const first = loadAnalyticsConfig();
    expect(loadAnalyticsConfig()).toBe(first);
    const stop = startAnalyticsConfigLoading();
    resolve(value);
    await first;
    await vi.advanceTimersByTimeAsync(120_000);
    await loadAnalyticsConfig();
    expect(request).toHaveBeenCalledTimes(1);
    expect(useAnalyticsConfig.getState()).toEqual({ config: value, loaded: true });
    stop();
  },
);

it('automatically recovers from transient failures and stops retrying once configured', async () => {
  const { startAnalyticsConfigLoading, useAnalyticsConfig } = await import('../api.ts');
  vi.useFakeTimers();
  request
    .mockRejectedValueOnce(new Error('Unavailable'))
    .mockRejectedValueOnce(new Error('Still unavailable'))
    .mockResolvedValueOnce(config);
  const stop = startAnalyticsConfigLoading();
  await vi.advanceTimersByTimeAsync(999);
  expect(request).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(request).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1999);
  expect(useAnalyticsConfig.getState().config).toBeNull();
  await vi.advanceTimersByTimeAsync(1);
  expect(useAnalyticsConfig.getState()).toEqual({ config, loaded: true });
  await vi.advanceTimersByTimeAsync(120_000);
  expect(request).toHaveBeenCalledTimes(3);
  stop();
});

it('paces a prolonged outage with a capped backoff and cancels scheduled retries on disposal', async () => {
  const { startAnalyticsConfigLoading } = await import('../api.ts');
  vi.useFakeTimers();
  request.mockRejectedValue(new Error('Offline'));
  const stop = startAnalyticsConfigLoading();
  await vi.advanceTimersByTimeAsync(0);
  for (const [index, delay] of [1000, 2000, 4000, 8000, 16_000, 30_000, 30_000].entries()) {
    await vi.advanceTimersByTimeAsync(delay - 1);
    expect(request).toHaveBeenCalledTimes(index + 1);
    await vi.advanceTimersByTimeAsync(1);
    expect(request).toHaveBeenCalledTimes(index + 2);
  }
  stop();
  await vi.advanceTimersByTimeAsync(120_000);
  expect(request).toHaveBeenCalledTimes(8);
});

it('bounds discovery requests and does not reschedule an in-flight failure after disposal', async () => {
  const { startAnalyticsConfigLoading } = await import('../api.ts');
  vi.useFakeTimers();
  const timeout = vi.spyOn(AbortSignal, 'timeout');
  let reject!: (error: Error) => void;
  request.mockImplementationOnce(
    () =>
      new Promise<never>((_resolve, fail) => {
        reject = fail;
      }),
  );
  const stop = startAnalyticsConfigLoading();
  expect(timeout).toHaveBeenCalledWith(5000);
  expect(request).toHaveBeenCalledWith(
    '/analytics/config',
    'GET',
    undefined,
    expect.any(AbortSignal),
  );
  stop();
  reject(new Error('Timed out'));
  await vi.advanceTimersByTimeAsync(120_000);
  expect(request).toHaveBeenCalledTimes(1);
});
