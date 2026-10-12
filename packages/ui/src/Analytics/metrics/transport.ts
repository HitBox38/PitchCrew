import type { AnalyticsConfig } from '../types.ts';
import { sanitizeRequestMetric, sanitizeRunMetric } from './sanitize.ts';

/** OTLP JSON is a documented PostHog numeric transport. No SDK metric queues,
 * automatic network instrumentation, retries, persistence or user identifiers.
 */
export function createMetricTransport(
  allowed: () => boolean,
  context: () => Record<string, unknown>,
  send: typeof fetch = (...args) => fetch(...args),
  now: () => number = Date.now,
) {
  let config: AnalyticsConfig | null = null;
  const pending = new Map<AbortController, ReturnType<typeof setTimeout>>();
  const stop = () => {
    for (const [controller, timer] of pending) {
      clearTimeout(timer);
      controller.abort();
    }
    pending.clear();
  };
  return {
    configure(next: AnalyticsConfig | null) {
      stop();
      config = next;
    },
    stop,
    record(event: string, input: Record<string, unknown>) {
      if (!config || !allowed() || pending.size >= 2) return;
      const properties =
        event === 'api_request_finished'
          ? sanitizeRequestMetric(input)
          : event === 'run_finished'
            ? sanitizeRunMetric(input)
            : null;
      if (!properties) return;
      let endpoint: URL;
      try {
        endpoint = new URL('/i/v1/metrics', config.host);
        if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) return;
      } catch {
        return;
      }
      const metadata = context();
      const attributes = Object.entries(properties)
        .filter(([key]) => key !== 'duration_ms')
        .map(([key, value]) => ({ key, value: { stringValue: String(value) } }));
      if (['browser', 'electron'].includes(metadata.renderer as string))
        attributes.push({ key: 'renderer', value: { stringValue: metadata.renderer as string } });
      const timeUnixNano = `${Math.trunc(now())}000000`;
      const stem = event === 'api_request_finished' ? 'pitchcrew.api.request' : 'pitchcrew.run';
      const point = { attributes, timeUnixNano, startTimeUnixNano: timeUnixNano };
      const metrics: Record<string, unknown>[] = [
        {
          name: `${stem}.count`,
          unit: '1',
          sum: {
            aggregationTemporality: 1,
            isMonotonic: true,
            dataPoints: [{ ...point, asDouble: 1 }],
          },
        },
      ];
      if (typeof properties.duration_ms === 'number')
        metrics.push({
          name: `${stem}.duration`,
          unit: 'ms',
          histogram: {
            aggregationTemporality: 1,
            dataPoints: [
              {
                ...point,
                count: 1,
                sum: properties.duration_ms,
                min: properties.duration_ms,
                max: properties.duration_ms,
                explicitBounds: [],
                bucketCounts: [1],
              },
            ],
          },
        });
      const resourceAttributes = [
        { key: 'service.name', value: { stringValue: 'pitchcrew-renderer' } },
      ];
      if (
        typeof metadata.app_version === 'string' &&
        /^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(metadata.app_version)
      )
        resourceAttributes.push({
          key: 'service.version',
          value: { stringValue: metadata.app_version },
        });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      pending.set(controller, timer);
      try {
        void send(endpoint.href, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
          body: JSON.stringify({
            resourceMetrics: [
              {
                resource: { attributes: resourceAttributes },
                scopeMetrics: [{ scope: { name: 'pitchcrew.application-metrics' }, metrics }],
              },
            ],
          }),
          signal: controller.signal,
          credentials: 'omit',
          redirect: 'error',
          keepalive: false,
        })
          .catch(() => {})
          .finally(() => {
            clearTimeout(timer);
            pending.delete(controller);
          });
      } catch {
        clearTimeout(timer);
        pending.delete(controller);
      }
    },
  };
}
