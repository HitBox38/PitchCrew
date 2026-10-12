import { afterEach, expect, it, vi } from 'vitest';
import { createMetricTransport } from '../transport.ts';

afterEach(() => vi.useRealTimers());
const config = { token: 'phc_fictional', host: 'https://eu.i.posthog.com' };

it('sends documented numeric OTLP only, with fixed dimensions and no user context', async () => {
  const send = vi.fn().mockResolvedValue(new Response());
  const transport = createMetricTransport(
    () => true,
    () => ({ renderer: 'electron', app_version: '0.2.0', distinct_id: 'private', url: '/private' }),
    send,
    () => 123,
  );
  transport.configure(config);
  transport.record('api_request_finished', {
    operation: 'chat_sent',
    result: 'http_error',
    duration_ms: 150,
    path: '/private',
    message: 'secret',
  });
  expect(send).toHaveBeenCalledTimes(1);
  const [endpoint, request] = send.mock.calls[0];
  expect(endpoint).toBe('https://eu.i.posthog.com/i/v1/metrics');
  expect(request).toMatchObject({ credentials: 'omit', redirect: 'error', keepalive: false });
  const body = JSON.parse(request.body);
  expect(body.resourceMetrics[0].resource.attributes).toEqual([
    { key: 'service.name', value: { stringValue: 'pitchcrew-renderer' } },
    { key: 'service.version', value: { stringValue: '0.2.0' } },
  ]);
  expect(body.resourceMetrics[0].scopeMetrics[0].metrics).toMatchObject([
    {
      name: 'pitchcrew.api.request.count',
      sum: { isMonotonic: true, aggregationTemporality: 1, dataPoints: [{ asDouble: 1 }] },
    },
    {
      name: 'pitchcrew.api.request.duration',
      unit: 'ms',
      histogram: { dataPoints: [{ count: 1, sum: 150, bucketCounts: [1] }] },
    },
  ]);
  expect(request.body).not.toMatch(/private|secret|distinct_id/);
});

it('does not invent histograms for runs with unknown duration or send unsupported metrics', () => {
  const send = vi.fn().mockResolvedValue(new Response());
  const transport = createMetricTransport(
    () => true,
    () => ({}),
    send,
  );
  transport.configure(config);
  transport.record('unreviewed', { duration_ms: 99 });
  transport.record('run_finished', { mode: 'chat', outcome: 'failed' });
  expect(send).toHaveBeenCalledTimes(1);
  expect(
    JSON.parse(send.mock.calls[0][1].body).resourceMetrics[0].scopeMetrics[0].metrics,
  ).toHaveLength(1);
});

it('bounds pending sends, aborts on disable, never queues/retries and expires requests', () => {
  vi.useFakeTimers();
  const send = vi.fn().mockImplementation(() => new Promise(() => {}));
  let allowed = true;
  const transport = createMetricTransport(
    () => allowed,
    () => ({}),
    send,
  );
  transport.configure(config);
  const properties = { mode: 'chat', outcome: 'completed', duration_ms: 10 };
  for (let i = 0; i < 5; i++) transport.record('run_finished', properties);
  expect(send).toHaveBeenCalledTimes(2);
  allowed = false;
  transport.configure(null);
  expect(send.mock.calls.every((call) => call[1].signal.aborted)).toBe(true);
  transport.record('run_finished', properties);
  expect(send).toHaveBeenCalledTimes(2);
  allowed = true;
  transport.configure(config);
  transport.record('run_finished', properties);
  vi.advanceTimersByTime(5000);
  expect(send.mock.calls[2][1].signal.aborted).toBe(true);
  expect(send).toHaveBeenCalledTimes(3);
});

it('drops disabled, non-HTTPS or invalid samples and isolates transport failures', () => {
  const send = vi.fn().mockImplementation(() => {
    throw new Error('private');
  });
  const transport = createMetricTransport(
    () => true,
    () => ({}),
    send,
  );
  transport.record('run_finished', { mode: 'chat', outcome: 'failed' });
  transport.configure({ ...config, host: 'http://unsafe.invalid' });
  transport.record('run_finished', { mode: 'chat', outcome: 'failed' });
  expect(send).not.toHaveBeenCalled();
  transport.configure(config);
  expect(() => transport.record('run_finished', { mode: 'chat', outcome: 'failed' })).not.toThrow();
});
