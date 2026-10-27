import { trace } from '@opentelemetry/api';
import { sanitizeLogCorrelation } from '@pitchcrew/core/operational-logs';
import { analytics } from './client.ts';

/** Called at dispatch, only for local API requests; opt-out and SDK loading add no IDs. */
export const diagnosticRequestHeaders = (): Record<string, string> => {
  try {
    const ids = analytics.getRequestContext?.();
    if (!ids) return {};
    const span = trace.getActiveSpan()?.spanContext();
    const correlation = sanitizeLogCorrelation({ ...ids, ...span });
    return {
      ...(correlation.posthogDistinctId
        ? { 'x-posthog-distinct-id': correlation.posthogDistinctId }
        : {}),
      ...(correlation.sessionId ? { 'x-posthog-session-id': correlation.sessionId } : {}),
      ...(correlation.traceId && correlation.spanId
        ? {
            traceparent: `00-${correlation.traceId}-${correlation.spanId}-${(correlation.traceFlags ?? 0).toString(16).padStart(2, '0')}`,
          }
        : {}),
    };
  } catch {
    return {};
  }
};
