import { expect, it } from 'vitest';
import type { Run, RunActivity } from '@pitchcrew/core';
import { activityPreview, activitySummary, blockedSteps } from '../activity-summary.ts';

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

it('treats a pause for a user takeover as neither a failure nor a settled issue', () => {
  const paused = {
    ...entry('paused', 'tool', 'interrupted'),
    label: 'Paused while you had control',
  };
  const entries = [entry('inspect', 'tool'), paused, entry('click', 'tool')];
  expect(activityPreview(run('completed', entries))).toEqual([]);
  expect(activitySummary(entries)).toBe('3 steps · paused while you had control');
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

it('shows the last finished step while the run waits on the user, not the blocked call', () => {
  const entries = [entry('asked', 'tool'), entry('blocked', 'tool', 'running')];
  expect(activityPreview(run('running', entries)).map((item) => item.id)).toEqual(['blocked']);
  expect(activityPreview(run('running', entries), true).map((item) => item.id)).toEqual(['asked']);
});

it('says a takeover happened without claiming a count it cannot know', () => {
  const pause = (id: string) => ({
    ...entry(id, 'tool', 'interrupted'),
    label: 'Paused while you had control',
  });
  const entries = [entry('read', 'tool'), pause('wait-1'), pause('wait-2'), entry('click', 'tool')];
  expect(activitySummary(entries)).toBe('4 steps · paused while you had control');
  // Interleaved work between waits, or a second takeover, never inflates or deflates a number.
  expect(activitySummary([...entries, pause('later')])).toBe(
    '5 steps · paused while you had control',
  );
});

it('finds the call blocked on the user by its exact label, leaving parallel calls working', () => {
  const browser = { ...entry('browser', 'tool', 'running'), label: 'Click “Learn more”' };
  const connector = {
    ...entry('connector', 'tool', 'running'),
    label: 'Reading connected sources',
  };
  expect([...blockedSteps([browser, connector], ['Click “Learn more”'])]).toEqual(['browser']);
  expect(blockedSteps([browser, connector], undefined).size).toBe(0);
  expect(blockedSteps([connector], ['Click “Learn more”']).size).toBe(0);
  // Asked but not yet carried out, the request waits whatever the agent does next; only its
  // latest row, since an earlier identical request may have lapsed.
  const lapsed = { ...entry('lapsed', 'tool'), label: 'Asked to click “Learn more”' };
  const asked = { ...entry('asked', 'tool'), label: 'Asked to click “Learn more”' };
  const askedIds = blockedSteps(
    [lapsed, asked, connector],
    ['Click “Learn more”', 'Asked to click “Learn more”'],
  );
  expect([...askedIds]).toEqual(['asked']);
  // Once the current request's call runs, only that running row waits; the lapsed identical
  // "Asked to …" row never regains the waiting state, wherever commentary splits the steps.
  const running = { ...entry('current', 'tool', 'running'), label: 'Click “Learn more”' };
  expect([
    ...blockedSteps(
      [lapsed, entry('note', 'commentary'), running],
      ['Click “Learn more”', 'Asked to click “Learn more”'],
    ),
  ]).toEqual(['current']);
  // The collapsed turn previews that waiting request, not a later finished step.
  expect(
    activityPreview(run('running', [lapsed, asked, connector]), true, askedIds).map(
      (item) => item.id,
    ),
  ).toEqual(['asked']);
  // While the user holds the page, every browser call waits (a page read included).
  const read = { ...entry('read', 'tool', 'running'), label: 'Reading the page' };
  expect([...blockedSteps([read, connector], ['Reading the page', 'Click “Learn more”'])]).toEqual([
    'read',
  ]);
});
