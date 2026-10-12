import { useDevicePreferences } from '../../lib/device-preferences.ts';
import { analytics } from '../client.ts';
import { analyticsContext } from '../context.ts';
import type { AnalyticsConfig } from '../types.ts';
import { startRequestMetric } from './requests.ts';
import { createMetricTransport } from './transport.ts';

let enabled = false;
let generation = 0;
const allowed = () => {
  const preferences = useDevicePreferences.getState();
  return enabled && preferences.analytics && preferences.diagnostics;
};
const transport = createMetricTransport(allowed, analyticsContext);
export const metricSink = {
  record(event: string, properties: Record<string, unknown>) {
    if (!allowed()) return;
    analytics.captureDiagnostic(event, properties);
    transport.record(event, properties);
  },
};

export function configureApplicationMetrics(config: AnalyticsConfig | null) {
  generation++;
  enabled = !!config;
  transport.configure(allowed() ? config : null);
}

/** Consent revocation invalidates pending observations even if re-enabled before completion. */
export function invalidateApplicationMetrics() {
  generation++;
  transport.stop();
}
export const applicationMetricsAllowed = allowed;
export function beginApiMetric(path: string, method: string, body: unknown) {
  const current = generation;
  return startRequestMetric(
    path,
    method,
    body,
    metricSink,
    () => current === generation && allowed(),
  );
}
