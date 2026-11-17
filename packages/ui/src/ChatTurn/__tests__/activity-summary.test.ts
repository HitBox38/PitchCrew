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
  expect(activityPreview(run('completed', entries.slice(1))).map((item) => item.id)).toEqual([
    'stopped',
  ]);
  expect(activitySummary(entries)).toBe('3 steps · 1 failed · 1 interrupted');
});

it('keeps up to the three latest failures of a turn that did not complete, in order', () => {
  const entries = [
    entry('first', 'tool', 'failed'),
    entry('update', 'commentary'),
    entry('second', 'tool', 'failed'),
    entry('read', 'tool'),
    entry('third', 'tool', 'failed'),
    entry('fourth', 'tool', 'failed'),
    entry('stopped', 'tool', 'interrupted'),
  ];
  for (const status of ['failed', 'cancelled', 'waiting'] as const)
    expect(activityPreview(run(status, entries)).map((item) => item.id)).toEqual([
      'second',
      'third',
      'fourth',
    ]);
  // The agent recovered from the earlier failures of a completed turn, so its history keeps only
  // the latest one rather than reading as a failure.
  expect(activityPreview(run('completed', entries)).map((item) => item.id)).toEqual(['fourth']);
});

it('keeps a live failure in view until three newer tool steps have started', () => {
  const steps = ['next', 'after', 'later'].map((id) => entry(id, 'tool'));
  const failure = entry('failure', 'tool', 'failed');
  const update = entry('update', 'commentary');
  const ids = (activity: RunActivity[]) =>
    activityPreview(run('running', activity)).map((item) => item.id);
  // Original order, alongside the latest update and the current step.
  expect(ids([failure, update, { ...steps[0], status: 'running' }])).toEqual([
    'failure',
    'update',
    'next',
  ]);
  expect(ids([update, failure, steps[0], { ...steps[1], status: 'running' }])).toEqual([
    'update',
    'failure',
    'after',
  ]);
  // A failure that is itself the latest step is shown once.
  expect(ids([update, steps[0], failure])).toEqual(['update', 'failure']);
  // Commentary never counts as a step that pushes the failure out.
  expect(ids([failure, steps[0], update, steps[1]])).toEqual(['failure', 'update', 'after']);
  expect(ids([failure, ...steps])).toEqual(['later']);
  // Thinking markers come between most calls of a reasoning runtime and never push it out, even
  // when the current step is one.
  const [t1, t2, t3] = ['t1', 't2', 't3'].map((id) => entry(id, 'reasoning'));
  const [next, after, later] = steps;
  expect(ids([failure, t1, next, { ...t2, status: 'running' }])).toEqual(['failure', 't2']);
  expect(ids([failure, t1, next, t2, { ...after, status: 'running' }])).toEqual([
    'failure',
    'after',
  ]);
  expect(ids([failure, t1, next, t2, after, t3, { ...later, status: 'running' }])).toEqual([
    'later',
  ]);
  // While the user holds the page the failure keeps its place beside the last finished step.
  const blocked = { ...steps[1], status: 'running' as const };
  expect(
    activityPreview(run('running', [failure, steps[0], blocked]), true).map((item) => item.id),
  ).toEqual(['failure', 'next']);
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

it('matches only browser steps, and older steps saved without a kind, as waiting on the user', () => {
  const labels = ['Reading the page', 'Asked to click “Learn more”'];
  const step = (
    id: string,
    label: string,
    tool: RunActivity['tool'],
    status: RunActivity['status'] = 'running',
  ): RunActivity => ({ ...entry(id, 'tool', status), label, tool });
  // A runtime's own tool, or a crew tool, whose words happen to equal a browser label.
  const native = step('native', labels[0], 'read');
  const asked = step('asked', labels[1], 'command', 'completed');
  expect([
    ...blockedSteps(
      [native, step('browser', labels[0], 'browser'), step('legacy', labels[0], undefined)],
      labels,
    ),
  ]).toEqual(['browser', 'legacy']);
  expect(blockedSteps([native, asked], labels).size).toBe(0);
  expect([...blockedSteps([{ ...asked, tool: 'browser' }], labels)]).toEqual(['asked']);
});
