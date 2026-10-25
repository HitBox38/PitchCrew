import type { DiagnosticSink } from '@pitchcrew/core';
import {
  sanitizeAiObservation,
  type AiRunMode,
  type AiRunOutcome,
} from '@pitchcrew/core/telemetry-ai';
import { randomUUID } from 'node:crypto';
import { failureDetails } from '@pitchcrew/core/operational-logs';

/** Records only local, content-free observations. Transport/consent belongs to the renderer. */
export const beginAiRun = (
  diagnostics: DiagnosticSink | undefined,
  mode: AiRunMode,
  {
    clock = () => performance.now(),
    wallClock = Date.now,
    id = randomUUID,
  }: {
    clock?: () => number;
    wallClock?: () => number;
    id?: () => string;
  } = {},
) => {
  const traceId = diagnostics ? id() : undefined;
  const start = clock();
  const startedAt = wallClock();
  let finished = false;
  let failure: ReturnType<typeof failureDetails> | undefined;
  const record = (event: string, properties: Record<string, unknown>) => {
    if (!diagnostics || !traceId) return;
    try {
      const sanitized = sanitizeAiObservation(event, {
        ...properties,
        $ai_trace_id: traceId,
        mode,
      });
      if (sanitized) diagnostics.record(event, sanitized);
    } catch {
      /* Observability cannot change run outcomes. */
    }
  };
  return {
    fail: (error: unknown) => {
      failure ??= failureDetails(error);
    },
    observe: async <T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> => {
      const spanId = diagnostics ? id() : undefined;
      const spanStart = clock();
      const spanStartedAt = wallClock();
      let outcome: AiRunOutcome = 'completed';
      try {
        return await operation();
      } catch (error) {
        outcome = signal.aborted ? 'cancelled' : 'failed';
        failure = failureDetails(error);
        throw error;
      } finally {
        if (signal.aborted) outcome = 'cancelled';
        record('$ai_span', {
          $ai_span_id: spanId,
          $ai_parent_id: traceId,
          $ai_latency: (clock() - spanStart) / 1000,
          observed_start_ms: spanStartedAt,
          outcome,
          ...failure,
        });
      }
    },
    finish: (outcome: AiRunOutcome) => {
      if (finished) return;
      finished = true;
      record('$ai_trace', {
        $ai_latency: (clock() - start) / 1000,
        observed_start_ms: startedAt,
        outcome,
        ...failure,
      });
    },
  };
};
