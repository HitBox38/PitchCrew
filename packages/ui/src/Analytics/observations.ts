import type { TelemetryBatch } from '@pitchcrew/core';

interface ObservationRelayOptions {
  allowed(): boolean;
  read(after?: number): Promise<TelemetryBatch>;
  capture(event: string, properties: Record<string, unknown>): void;
}

/** Starts at the live cursor; opting back in never uploads a disabled period's backlog. */
export const createObservationRelay = ({ allowed, read, capture }: ObservationRelayOptions) => {
  let generation = 0;
  let streamId: string | undefined;
  let cursor: number | undefined;
  let pending = false;
  return {
    poll: async () => {
      if (pending || !allowed()) return;
      pending = true;
      const turn = generation;
      try {
        const batch = await read(cursor);
        if (turn !== generation || !allowed()) return;
        if (
          !batch.enabled ||
          !Number.isSafeInteger(batch.cursor) ||
          batch.cursor < 0 ||
          typeof batch.streamId !== 'string' ||
          !Array.isArray(batch.observations)
        )
          return;
        if (streamId === batch.streamId && cursor !== undefined) {
          if (batch.cursor < cursor) return;
          const seen = new Set<number>();
          for (const observation of batch.observations.slice(0, 1000)) {
            if (!allowed() || turn !== generation) break;
            if (
              !Number.isSafeInteger(observation.sequence) ||
              observation.sequence <= cursor ||
              observation.sequence > batch.cursor ||
              seen.has(observation.sequence) ||
              typeof observation.event !== 'string' ||
              !observation.properties ||
              typeof observation.properties !== 'object' ||
              Array.isArray(observation.properties)
            )
              continue;
            seen.add(observation.sequence);
            try {
              capture(observation.event, observation.properties);
            } catch {
              /* Best effort. */
            }
          }
        }
        streamId = batch.streamId;
        cursor = batch.cursor;
      } catch {
        /* A local diagnostic polling failure cannot interrupt the workspace. */
      } finally {
        pending = false;
      }
    },
    reset: () => {
      generation++;
      streamId = undefined;
      cursor = undefined;
    },
  };
};
