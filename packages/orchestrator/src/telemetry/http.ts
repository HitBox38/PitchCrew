import type { HttpOperation } from '@pitchcrew/core/operational-logs';
import { sanitizeLogCorrelation } from '@pitchcrew/core/operational-logs';
import { trace } from '@opentelemetry/api';
import type { FastifyRequest } from 'fastify';

/** Capture at emission, before the buffer/renderer boundary loses the active request. */
export const httpLogCorrelation = (request: FastifyRequest) => {
  try {
    if (request.headers['x-pitchcrew-client'] !== 'ui') return {};
    const span = trace.getActiveSpan()?.spanContext();
    const parent = request.headers.traceparent;
    // Accept W3C version 00 only; malformed/duplicate headers and zero IDs are discarded.
    const match =
      typeof parent === 'string'
        ? /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/.exec(parent)
        : null;
    const incoming = match
      ? sanitizeLogCorrelation({
          traceId: match[1],
          spanId: match[2],
          traceFlags: parseInt(match[3]!, 16),
        })
      : {};
    const active = span ? sanitizeLogCorrelation({ ...span }) : {};
    return sanitizeLogCorrelation({
      ...(active.traceId && active.spanId
        ? active
        : incoming.traceId && incoming.spanId
          ? incoming
          : {}),
      sessionId: request.headers['x-posthog-session-id'],
      posthogDistinctId: request.headers['x-posthog-distinct-id'],
    });
  } catch {
    return {};
  }
};

/** Match registered route templates only; request URLs, parameters and bodies stay local. */
export const httpFailureOperation = (
  method: string,
  route: string | undefined,
): HttpOperation | undefined => {
  if (method !== 'POST') return undefined;
  switch (route) {
    case '/api/cards/:id/approval':
      return 'packet_export_requested';
    case '/api/approvals/:id/export':
      return 'packet_exported';
    case '/api/cards/:id/run':
      return 'workflow_started';
    default:
      return undefined;
  }
};
