import { expect, it } from 'vitest';
import type { Role, Routine, Run } from '@pitchcrew/core';
import { initialDraft } from '../helpers.ts';
import {
  nextRunLine,
  nextRunPreview,
  nextRunSummary,
  routinesFact,
  routineStatus,
  runLimitLabel,
} from '../schedule-preview.ts';

const draft = {
  ...initialDraft(null),
  name: 'Fictional routine',
  content: 'Fictional action',
  timezone: 'Asia/Jerusalem',
  startLocal: '2030-01-05T09:00', // A Saturday.
  endLocal: '',
};

it('previews the first run the daemon will schedule for preset repeats', () => {
  expect(nextRunPreview({ ...draft, frequency: 'once' })).toBe('2030-01-05T07:00:00.000Z');
  expect(nextRunPreview({ ...draft, frequency: 'interval', interval: '2', unit: 'hours' })).toBe(
    '2030-01-05T07:00:00.000Z',
  );
  expect(nextRunPreview({ ...draft, frequency: 'weekdays' })).toBe('2030-01-07T07:00:00.000Z');
  expect(nextRunPreview({ ...draft, frequency: 'weekly' })).toBe('2030-01-05T07:00:00.000Z');
  expect(nextRunPreview({ ...draft, frequency: 'monthly', startLocal: '2030-01-31T09:00' })).toBe(
    '2030-01-31T07:00:00.000Z',
  );
  expect(nextRunPreview({ ...draft, frequency: 'custom' })).toBeUndefined();
  expect(
    nextRunPreview({ ...draft, frequency: 'weekdays', endLocal: '2030-01-06T09:00' }),
  ).toBeNull();
});

it('summarises the next run in the routine timezone, or why there is none', () => {
  const now = Date.parse('2030-01-01T00:00:00Z');
  const base = { ...draft, frequency: 'weekdays' as const };
  expect(nextRunSummary(base, base, null, now)).toMatch(/^Next run .*\(Asia\/Jerusalem\)\.$/);
  expect(nextRunSummary({ ...base, enabled: false }, base, null, now)).toMatch(/^Paused;/);
  expect(nextRunSummary(base, base, null, Date.parse('2031-01-01T00:00:00Z'))).toMatch(/^Due now/);
  expect(nextRunSummary({ ...base, frequency: 'custom' }, base, null, now)).toMatch(/cron/);
  const routine = { runCount: 3, nextRunAt: '2030-01-07T07:00:00.000Z' } as Routine;
  expect(nextRunSummary({ ...base, maxRuns: '3' }, base, routine, now)).toMatch(/limit/);
  expect(nextRunSummary(base, base, { ...routine, nextRunAt: null }, now)).toBe(
    'No further runs are scheduled.',
  );
});

it('names routine state and counts with the bead law', () => {
  const routine = { enabled: true, nextRunAt: 'x', error: '' } as Routine;
  const role = { enabled: true } as Role;
  expect(routineStatus(routine, role, { status: 'running' } as Run)).toEqual({
    label: 'Running',
    tone: 'plum',
  });
  expect(routineStatus({ ...routine, error: 'Broken' }, role, undefined).tone).toBe('rose');
  expect(routineStatus({ ...routine, nextRunAt: null }, role, undefined).label).toBe('Finished');
  expect(routineStatus({ ...routine, enabled: false }, role, undefined)).toEqual({
    label: 'Paused',
    tone: undefined,
  });
  expect(routineStatus(routine, { enabled: false } as Role, undefined).tone).toBe('ochre');
  expect(routineStatus(routine, role, undefined).label).toBe('Scheduled');
  expect(
    routinesFact([routine, { enabled: false, nextRunAt: 'x' }, { enabled: true, nextRunAt: null }]),
  ).toBe('1 active, 1 paused');
  expect(runLimitLabel({ runCount: 2, maxRuns: 5 })).toBe('2 of 5 runs');
  expect(runLimitLabel({ runCount: 1, maxRuns: null })).toBe('1 run');
});

it('never promises a next run for a paused routine', () => {
  const routine = {
    enabled: true,
    nextRunAt: '2030-01-05T07:00:00.000Z',
    timezone: 'Asia/Jerusalem',
  } as Routine;
  expect(nextRunLine(routine)).toMatch(/^Next .+ · Asia\/Jerusalem$/);
  expect(nextRunLine({ ...routine, enabled: false })).toBe('Paused — no run scheduled');
  expect(nextRunLine({ ...routine, nextRunAt: null })).toBe('No run scheduled');
});
