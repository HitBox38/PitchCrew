import type { ChatMessage, Run, RunActivity } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import { activityGroups, durationLabel, transcriptItems } from '../helpers.ts';

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

it('formats elapsed time for live, completed and malformed timestamps', () => {
  expect(durationLabel(startedAt, null, Date.parse(startedAt) + 62000)).toBe('1m 2s');
  expect(durationLabel(startedAt, startedAt, Date.parse(startedAt) + 62000)).toBe('0s');
  expect(durationLabel('bad', null, 0)).toBe('0s');
});
