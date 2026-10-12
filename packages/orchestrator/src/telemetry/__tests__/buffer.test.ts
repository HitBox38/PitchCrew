import { expect, it, vi } from 'vitest';
import { createTelemetryBuffer } from '../buffer.ts';

it('keeps only bounded sanitized observations and expires them without persistence or transport', () => {
  let time = 0;
  const buffer = createTelemetryBuffer(
    (event, input) => (event === 'fixture' ? { count: Number(input.count) } : null),
    true,
    { capacity: 2, lifetime: 100, now: () => time },
  );
  buffer.record('unknown', { content: 'private' });
  for (const count of [1, 2, 3])
    buffer.record('fixture', { count, content: 'private', url: 'private' });
  expect(buffer.read().observations).toEqual([]);
  expect(buffer.read(0).observations).toEqual([
    { sequence: 2, event: 'fixture', properties: { count: 2 } },
    { sequence: 3, event: 'fixture', properties: { count: 3 } },
  ]);
  const batch = buffer.read(2);
  batch.observations[0].properties.count = 999;
  expect(buffer.read(2).observations[0].properties.count).toBe(3);
  time = 101;
  expect(buffer.read(0).observations).toEqual([]);
  expect(buffer.read(0).cursor).toBe(3);
});

it('does not invoke sanitizers when disabled and contains bad measurements and sanitizer failures', () => {
  const sanitizer = vi.fn(() => ({ count: 1 }));
  const offline = createTelemetryBuffer(sanitizer);
  offline.record('fixture', {});
  expect(sanitizer).not.toHaveBeenCalled();
  expect(offline.read(0)).toMatchObject({ enabled: false, cursor: 0, observations: [] });
  const buffer = createTelemetryBuffer(() => {
    throw new Error('private');
  }, true);
  expect(() => buffer.record('fixture', {})).not.toThrow();
  expect(buffer.read(0).cursor).toBe(0);
  const invalid = createTelemetryBuffer(() => ({ count: Number.NaN }), true);
  invalid.record('fixture', {});
  expect(invalid.read(0).observations).toEqual([]);
});
