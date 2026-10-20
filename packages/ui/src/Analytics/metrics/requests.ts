import { actionEvent } from '../helpers.ts';
import type { DiagnosticSink } from '@pitchcrew/core';
import { sanitizeRequestMetric, type requestResults } from './sanitize.ts';

/** A per-request closure holds only a fixed operation and monotonic start time. */
export const startRequestMetric = (
  path: string,
  method: string,
  body: unknown,
  sink: DiagnosticSink,
  allowed: () => boolean,
  now: () => number = () => performance.now(),
) => {
  const operation = actionEvent(path, method, body)?.event;
  if (!operation || !allowed()) return () => {};
  const started = now();
  let finished = false;
  return (result: (typeof requestResults)[number]) => {
    if (finished) return;
    finished = true;
    if (!allowed()) return;
    const properties = sanitizeRequestMetric({ operation, result, duration_ms: now() - started });
    if (properties) {
      try {
        sink.record('api_request_finished', properties);
      } catch {
        /* Never affect the request. */
      }
    }
  };
};
