import { expect, it, vi } from 'vitest';
import type { TelemetryBatch } from '@pitchcrew/core';
import { createObservationRelay } from '../observations.ts';

const batch = (streamId: string, cursor: number): TelemetryBatch => ({
  enabled: true,
  streamId,
  cursor,
  observations: [{ sequence: cursor, event: 'fixture', properties: { count: 1 } }],
});

it('skips history and daemon restarts, captures fresh observations once and never sends local correlation fields', async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce(batch('one', 5))
    .mockResolvedValueOnce(batch('one', 6))
    .mockResolvedValueOnce(batch('one', 6))
    .mockResolvedValueOnce(batch('two', 50));
  const capture = vi.fn();
  const relay = createObservationRelay({ allowed: () => true, read, capture });
  for (let turn = 0; turn < 4; turn++) await relay.poll();
  expect(read.mock.calls.map(([cursor]) => cursor)).toEqual([undefined, 5, 6, 6]);
  expect(capture).toHaveBeenCalledExactlyOnceWith('fixture', { count: 1 });
});

it('drops in-flight observations on opt-out and starts fresh after re-enabling', async () => {
  let allowed = true;
  let resolve!: (value: TelemetryBatch) => void;
  const capture = vi.fn();
  const read = vi
    .fn()
    .mockResolvedValueOnce(batch('one', 1))
    .mockImplementationOnce(
      () =>
        new Promise<TelemetryBatch>((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValueOnce(batch('one', 3));
  const relay = createObservationRelay({ allowed: () => allowed, read, capture });
  await relay.poll();
  const pending = relay.poll();
  allowed = false;
  relay.reset();
  resolve(batch('one', 2));
  await pending;
  await relay.poll();
  expect(read).toHaveBeenCalledTimes(2);
  allowed = true;
  await relay.poll();
  expect(read).toHaveBeenLastCalledWith(undefined);
  expect(capture).not.toHaveBeenCalled();
});
