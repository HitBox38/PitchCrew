import { randomUUID } from 'node:crypto';
import type {
  DiagnosticObservation,
  DiagnosticSanitizer,
  DiagnosticSink,
  TelemetryBatch,
} from '@pitchcrew/core';

/** Bounded, nonpersistent observations; an opted-in renderer owns all outward transport. */
export function createTelemetryBuffer(
  sanitize: DiagnosticSanitizer,
  enabled = false,
  { capacity = 256, lifetime = 60_000, now = Date.now } = {},
): DiagnosticSink & { read(after?: number): TelemetryBatch; clear(): void } {
  const streamId = randomUUID();
  let cursor = 0;
  let entries: { expires: number; observation: DiagnosticObservation }[] = [];
  const expire = () => {
    entries = entries.filter((entry) => entry.expires > now());
  };
  return {
    record(event, input) {
      if (!enabled) return;
      try {
        const properties = sanitize(event, input);
        if (!properties || Object.keys(properties).length > 32) return;
        if (
          Object.entries(properties).some(
            ([key, value]) =>
              key.length > 64 ||
              (typeof value === 'number'
                ? !Number.isFinite(value)
                : typeof value === 'string'
                  ? value.length > 200
                  : typeof value !== 'boolean'),
          )
        )
          return;
        expire();
        entries.push({
          expires: now() + lifetime,
          observation: { sequence: ++cursor, event, properties: { ...properties } },
        });
        entries = entries.slice(-Math.max(1, Math.min(capacity, 1000)));
      } catch {
        /* Observability cannot change application behavior. */
      }
    },
    read(after = cursor) {
      expire();
      return {
        enabled,
        streamId,
        cursor,
        observations: entries
          .filter((entry) => entry.observation.sequence > after)
          .map(({ observation }) => ({
            ...observation,
            properties: { ...observation.properties },
          })),
      };
    },
    clear() {
      entries = [];
    },
  };
}
