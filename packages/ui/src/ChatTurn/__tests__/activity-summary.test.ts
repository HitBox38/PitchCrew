import { expect, it } from 'vitest';
import type { Run, RunActivity } from '@pitchcrew/core';
import { activityPreview, activitySummary } from '../activity-summary.ts';

const at = '2026-11-06T16:00:00.000Z';
const entry = (
  id: string,
  kind: RunActivity['kind'],
  status: RunActivity['status'] = 'completed',
): RunActivity => ({
  id,
  kind,
  status,
  label: id,
  text: kind === 'commentary' ? id : undefined,
  startedAt: at,
  finishedAt: status === 'running' ? null : at,
});
const run = (status: Run['status'], activity: RunActivity[]): Run => ({
  id: 'run',
  roleId: 'scout',
  runtime: 'codex',
  cardId: null,
  status,
  message: '',
  startedAt: at,
  finishedAt: status === 'running' ? null : at,
  activity,
});

it('bounds live context across interleaved commentary and tool batches in original order', () => {
  const entries = [
    entry('update1', 'commentary'),
    entry('tool1', 'tool'),
    entry('update2', 'commentary'),
    entry('tool2', 'tool', 'running'),
  ];
  expect(activityPreview(run('running', entries)).map((item) => item.id)).toEqual([
    'update2',
    'tool2',
  ]);
  expect(activityPreview(run('completed', entries))).toEqual([]);
});

it('keeps the latest failed or interrupted step visible after settlement', () => {
  const entries = [
    entry('failure', 'tool', 'failed'),
    entry('recovery', 'tool'),
    entry('stopped', 'tool', 'interrupted'),
  ];
  for (const status of ['completed', 'failed', 'waiting', 'cancelled'] as const)
    expect(activityPreview(run(status, entries)).map((item) => item.id)).toEqual(['failure']);
  expect(activitySummary(entries)).toBe('3 steps · 1 failed · 1 interrupted');
});

it('keeps an ongoing parallel tool visible when a later quick tool finishes first', () => {
  const entries = [
    entry('ongoing', 'tool', 'running'),
    entry('update', 'commentary'),
    entry('quick', 'tool'),
  ];
  expect(activityPreview(run('running', entries)).map((item) => item.id)).toEqual([
    'ongoing',
    'update',
  ]);
});

it('counts only nonempty public updates and accurately labels singular work', () => {
  expect(
    activitySummary([
      entry('thinking', 'reasoning'),
      entry('update', 'commentary'),
      { ...entry('blank', 'commentary'), text: ' ' },
    ]),
  ).toBe('1 step · 1 update');
  expect(activityPreview(run('running', []))).toEqual([]);
  expect(activitySummary([])).toBe('');
});
