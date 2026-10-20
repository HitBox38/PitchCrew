import type { DiagnosticSink, Run } from '@pitchcrew/core';
import { durationLimitMs, runOutcomes, sanitizeRunMetric } from './sanitize.ts';

type ObservedRun = Pick<Run, 'id' | 'status' | 'mode' | 'startedAt' | 'finishedAt'>;

/** Observe only active runs first seen after this observer was installed. IDs stay local.
 * Stop admitting runs at capacity rather than evicting dedup state and replaying history.
 */
export const createRunMetrics = (
  sink: DiagnosticSink,
  allowed: () => boolean,
  now: () => number = Date.now,
  capacity = 512,
) => {
  let sessionStart = now();
  const observed = new Map<string, { start: number; finished: boolean }>();
  const reset = () => {
    observed.clear();
    sessionStart = now();
  };
  return {
    reset,
    observe: (runs: readonly ObservedRun[]) => {
      if (!allowed()) {
        reset();
        return;
      }
      for (const run of runs) {
        if (typeof run.id !== 'string' || !run.id.length || run.id.length > 128) continue;
        let entry = observed.get(run.id);
        if (!entry) {
          const start = Date.parse(run.startedAt);
          if (
            !['running', 'waiting'].includes(run.status) ||
            !Number.isFinite(start) ||
            start < sessionStart ||
            start > now() ||
            observed.size >= capacity
          )
            continue;
          entry = { start, finished: false };
          observed.set(run.id, entry);
        }
        if (entry.finished || !runOutcomes.includes(run.status as never)) continue;
        entry.finished = true;
        const finish = run.finishedAt ? Date.parse(run.finishedAt) : NaN;
        const elapsed = finish - entry.start;
        const properties = sanitizeRunMetric({
          outcome: run.status,
          mode: run.mode ?? 'workflow',
          ...(Number.isFinite(finish) &&
          finish <= now() &&
          elapsed >= 0 &&
          elapsed <= durationLimitMs
            ? { duration_ms: elapsed }
            : {}),
        });
        if (properties) {
          try {
            sink.record('run_finished', properties);
          } catch {
            /* Best effort. */
          }
        }
      }
    },
  };
};
