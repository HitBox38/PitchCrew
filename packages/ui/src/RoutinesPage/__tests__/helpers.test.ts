import { expect, it } from 'vitest';
import { draftInput, initialDraft, instantTime, localTime } from '../helpers.ts';

it('converts wall times in the chosen timezone and rejects nonexistent DST times', () => {
  expect(instantTime('2030-01-01T09:00', 'Asia/Jerusalem')).toBe('2030-01-01T07:00:00.000Z');
  expect(localTime('2030-07-01T06:00:00Z', 'Asia/Jerusalem')).toBe('2030-07-01T09:00:00');
  expect(instantTime('2030-01-01T09:00:25', 'Asia/Jerusalem')).toBe('2030-01-01T07:00:25.000Z');
  expect(instantTime('2030-03-10T09:00', 'America/New_York')).toBe('2030-03-10T13:00:00.000Z');
  expect(() => instantTime('2030-03-10T02:30', 'America/New_York')).toThrow('does not exist');
});
it('turns friendly calendar and elapsed repeats into exact timestamps and limits', () => {
  const draft = {
    ...initialDraft(null),
    name: 'Fictional routine',
    content: 'Fictional action',
    timezone: 'Asia/Jerusalem',
    startLocal: '2030-01-01T09:00',
    endLocal: '2030-01-15T09:00',
    maxRuns: '5',
  };
  expect(draftInput({ ...draft, frequency: 'weekdays' })).toMatchObject({
    startAt: '2030-01-01T07:00:00.000Z',
    endsAt: '2030-01-15T07:00:00.000Z',
    cron: '0 9 * * 1-5',
    intervalMinutes: null,
    maxRuns: 5,
  });
  expect(draftInput({ ...draft, frequency: 'weekly' }).cron).toBe('0 9 * * 2');
  expect(
    draftInput({ ...draft, frequency: 'interval', interval: '3', unit: 'hours' }),
  ).toMatchObject({ cron: null, intervalMinutes: 180 });
});
