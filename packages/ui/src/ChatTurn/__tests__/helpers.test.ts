import type { ChatMessage, Run, RunActivity } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import { activityGroups, durationLabel, runModel, transcriptItems } from '../helpers.ts';

const startedAt = '2026-10-13T08:00:00.000Z';
const entry: RunActivity = {
  id: 't',
  kind: 'tool',
  label: 'Reading profile',
  status: 'completed',
  startedAt,
  finishedAt: startedAt,
};
const run: Run = {
  id: 'run',
  roleId: 'scout',
  runtime: 'demo',
  cardId: null,
  mode: 'chat',
  threadId: 'chat',
  message: '',
  startedAt,
  finishedAt: startedAt,
  status: 'completed',
  activity: [entry],
};
const user: ChatMessage = {
  id: 'user',
  threadId: 'chat',
  from: 'user',
  to: 'scout',
  content: 'Help',
  runId: 'run',
  cardId: null,
  createdAt: startedAt,
};

it('anchors each run after its trigger and before its answer even when all timestamps match', () => {
  const reply = { ...user, id: 'answer', from: 'scout' as const };
  expect(transcriptItems([user, reply], [run], 'chat').map((item) => item.id)).toEqual([
    'user',
    'turn-run',
    'answer',
  ]);
  expect(transcriptItems([user, reply], [run], 'other')).toEqual([
    expect.objectContaining({ kind: 'message' }),
    expect.objectContaining({ kind: 'message' }),
  ]);
});

it('retains stopped and silent activity, omits legacy completed runs, and separates crew follow-ups', () => {
  const child = {
    ...run,
    id: 'child',
    roleId: 'writer' as const,
    startedAt: '2026-10-13T08:00:01.000Z',
  };
  const items = transcriptItems(
    [user],
    [
      run,
      child,
      { ...run, id: 'legacy', activity: undefined },
      { ...run, id: 'running', status: 'running', activity: undefined, threadId: 'other' },
    ],
    'chat',
  );
  expect(items.map((item) => item.id)).toEqual(['user', 'turn-run', 'turn-child']);
});

it('groups contiguous tools and thinking without hiding interleaved commentary', () => {
  const commentary = {
    ...entry,
    id: 'c',
    kind: 'commentary' as const,
    text: 'Checking requirements.',
  };
  expect(
    activityGroups([
      entry,
      { ...entry, id: 'thinking', kind: 'reasoning' },
      commentary,
      { ...entry, id: 'last' },
    ]).map((group) => [group.kind, group.entries.length]),
  ).toEqual([
    ['work', 2],
    ['commentary', 1],
    ['work', 1],
  ]);
  expect(activityGroups([{ ...commentary, text: '' }])).toEqual([]);
});

it('joins settled parallel group turns to their own replies even when final timestamps tie', () => {
  const coach = { ...run, id: 'coach', roleId: 'coach' };
  const scout = { ...run, id: 'scout', startedAt: '2026-10-13T08:00:01.000Z' };
  const replies = [
    {
      ...user,
      id: 'scout-answer',
      from: 'scout',
      to: 'user',
      runId: 'scout',
      createdAt: '2026-10-13T08:00:03.000Z',
    },
    {
      ...user,
      id: 'coach-answer',
      from: 'coach',
      to: 'user',
      runId: 'coach',
      createdAt: '2026-10-13T08:00:03.000Z',
    },
  ];
  const result = transcriptItems([user, ...replies], [coach, scout], 'chat');
  expect(result.map((item) => item.id)).toEqual([
    'user',
    'turn-scout',
    'scout-answer',
    'turn-coach',
    'coach-answer',
  ]);
  expect(result.map((item) => item.createdAt)).toEqual([
    startedAt,
    ...Array(4).fill('2026-10-13T08:00:03.000Z'),
  ]);
});

it('keeps active group activity chronological instead of moving it beside streaming replies', () => {
  const active = { ...run, status: 'running' as const };
  const other = { ...user, id: 'other', runId: null, createdAt: '2026-10-13T08:00:01.000Z' };
  const partial = {
    ...user,
    id: 'partial',
    from: 'scout',
    to: 'user',
    createdAt: '2026-10-13T08:00:02.000Z',
  };
  expect(transcriptItems([user, other, partial], [active], 'chat').map((item) => item.id)).toEqual([
    'user',
    'turn-run',
    'other',
    'partial',
  ]);
});

it('shows failures and stops even when a runtime never emitted activity or an answer', () => {
  const failed = {
    ...run,
    runtime: 'codex' as const,
    id: 'failed',
    status: 'failed' as const,
    activity: undefined,
    message: 'Runtime exited before replying.',
  };
  const stopped = { ...failed, id: 'stopped', status: 'cancelled' as const };
  expect(transcriptItems([], [failed, stopped], 'chat').map((item) => item.id)).toEqual([
    'turn-failed',
    'turn-stopped',
  ]);
});

it('formats elapsed time for live, completed and malformed timestamps', () => {
  expect(durationLabel(startedAt, null, Date.parse(startedAt) + 62000)).toBe('1m 2s');
  expect(durationLabel(startedAt, startedAt, Date.parse(startedAt) + 62000)).toBe('0s');
  expect(durationLabel('bad', null, 0)).toBe('0s');
});

it('names the model and reasoning a turn ran with, falling back to the runtime', () => {
  const codex: Run = { ...run, runtime: 'codex' };
  expect(runModel(codex)).toBe('Codex');
  expect(runModel({ ...codex, model: 'gpt-6-sol', reasoning: 'high' })).toBe('gpt-6-sol · High');
  expect(runModel({ ...codex, reasoning: 'low' })).toBe('Codex · Low');
  expect(
    runModel({ ...codex, model: 'gpt-6-sol' }, [{ value: 'gpt-6-sol', label: 'GPT-6.1 Sol' }]),
  ).toBe('GPT-6.1 Sol');
  expect(
    runModel({ ...codex, model: 'gpt-7', reasoning: 'high' }, [
      { value: 'gpt-6-sol', label: 'GPT-6.1 Sol' },
    ]),
  ).toBe('gpt-7 · High');
  const configured = {
    ...codex,
    configuration: {
      role: { model: 'gpt-6-astra', reasoning: 'medium' },
      revision: 'r',
      skills: [],
      skillsRevision: 's',
    },
  } as unknown as Run;
  expect(runModel(configured)).toBe('gpt-6-astra · Medium');
});
