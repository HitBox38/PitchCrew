import { expect, it } from 'vitest';
import type { ChatMessage, ConversationHistoryPage, Run } from '@pitchcrew/core';
import { keepShownItems, liveHistoryItems } from '../remote-history.ts';

const message = (id: string, from = 'scout'): ChatMessage => {
  return {
    id,
    threadId: 'scout',
    from,
    to: 'user',
    content: `Fictional ${id}`,
    cardId: null,
    runId: null,
    createdAt: '2026-10-17T00:00:00.000Z',
  };
};
it('merges live replies into the latest server page once and bounds the mounted transcript', () => {
  const messages = Array.from({ length: 50 }, (_, i) => message(String(i), 'user'));
  const page: ConversationHistoryPage = {
    items: messages.map((m) => ({ kind: 'message', id: m.id, createdAt: m.createdAt, message: m })),
    start: 100,
    end: 150,
    total: 150,
    older: '50',
    newer: null,
  };
  const result = liveHistoryItems(
    page,
    [messages[49], message('new'), { ...message('elsewhere'), threadId: 'writer' }],
    [],
    'scout',
  );
  expect(result).toHaveLength(50);
  expect(result.at(-1)?.id).toBe('new');
  expect(result.filter((item) => item.id === '49')).toHaveLength(1);
  expect(result.some((item) => item.id === 'elsewhere')).toBe(false);
});

it('keeps saved activity and its trigger timestamp when workspace run metadata has no body', () => {
  const run = {
    id: 'saved',
    roleId: 'scout',
    runtime: 'demo' as const,
    threadId: 'scout',
    mode: 'chat' as const,
    cardId: null,
    status: 'completed' as const,
    startedAt: '2026-10-17T00:00:10.000Z',
    finishedAt: null,
    message: '',
    activity: [
      {
        id: 'work',
        kind: 'commentary' as const,
        label: 'Fictional',
        text: 'Saved activity',
        status: 'completed' as const,
        startedAt: '',
        finishedAt: '',
      },
    ],
  };
  const page: ConversationHistoryPage = {
    items: [{ kind: 'turn', id: 'turn-saved', createdAt: '2026-10-17T00:00:00.000Z', run }],
    start: 0,
    end: 1,
    total: 1,
    older: null,
    newer: null,
  };
  const { activity: _activity, ...metadata } = run;
  expect(liveHistoryItems(page, [], [metadata], 'scout')).toEqual(page.items);
});

it('does not re-sort joined parallel turns back to their start timestamps while merging live data', () => {
  const at = '2026-10-17T00:00:10.000Z';
  const runs = ['coach', 'scout'].map((id) => ({
    id,
    roleId: id,
    runtime: 'codex' as const,
    threadId: 'scout',
    mode: 'chat' as const,
    cardId: null,
    status: 'completed' as const,
    startedAt: '2026-10-17T00:00:00.000Z',
    finishedAt: at,
    message: '',
    activity: [
      {
        id: `${id}-step`,
        kind: 'tool' as const,
        label: 'Done',
        status: 'completed' as const,
        startedAt: '',
        finishedAt: '',
      },
    ],
  }));
  const replies = [message('scout-reply'), { ...message('coach-reply'), from: 'coach' }].map(
    (reply) => ({ ...reply, createdAt: at, runId: reply.from }),
  );
  const page: ConversationHistoryPage = {
    items: [
      { kind: 'turn', id: 'turn-scout', createdAt: at, run: runs[1] },
      { kind: 'message', id: replies[0].id, createdAt: at, message: replies[0] },
      { kind: 'turn', id: 'turn-coach', createdAt: at, run: runs[0] },
      { kind: 'message', id: replies[1].id, createdAt: at, message: replies[1] },
    ],
    start: 0,
    end: 4,
    total: 4,
    older: null,
    newer: null,
  };
  expect(liveHistoryItems(page, [], runs, 'scout').map((item) => item.id)).toEqual([
    'turn-scout',
    'scout-reply',
    'turn-coach',
    'coach-reply',
  ]);
});

it('merges waiting metadata without dropping saved activity or a queued input’s server dispatch time', () => {
  const createdAt = '2026-10-17T00:00:06.000Z';
  const input = { ...message('queued-input', 'user'), runId: null };
  const run: Run = {
    id: 'delivery',
    roleId: 'scout',
    runtime: 'codex',
    threadId: 'scout',
    mode: 'chat',
    cardId: null,
    status: 'running',
    startedAt: createdAt,
    finishedAt: null,
    message: '',
    activity: [
      {
        id: 'step',
        kind: 'tool',
        label: 'Saved step',
        status: 'completed',
        startedAt: createdAt,
        finishedAt: createdAt,
      },
    ],
  };
  const page: ConversationHistoryPage = {
    items: [
      { kind: 'message', id: input.id, createdAt, message: input },
      { kind: 'turn', id: 'turn-delivery', createdAt, run },
    ],
    start: 0,
    end: 2,
    total: 2,
    older: null,
    newer: null,
  };
  const { activity: _activity, ...metadata } = run;
  const result = liveHistoryItems(
    page,
    [],
    [{ ...metadata, status: 'waiting', message: 'Waiting for your answer.' }],
    'scout',
  );
  expect(result[0]).toEqual(page.items[0]);
  expect(result[1]).toMatchObject({
    run: { status: 'waiting', message: 'Waiting for your answer.', activity: run.activity },
  });
  const reply = { ...message('final'), runId: run.id, createdAt: '2026-10-18T00:00:09.000Z' };
  const settled = liveHistoryItems(page, [reply], [{ ...metadata, status: 'completed' }], 'scout');
  expect(settled.map((item) => item.id)).toEqual([input.id, 'turn-delivery', reply.id]);
  expect(settled[1].createdAt).toBe(reply.createdAt);
});

it('keeps what the reader has seen on the latest page', () => {
  const item = (id: string) => ({
    kind: 'message' as const,
    id,
    createdAt: '2026-10-17T00:00:00.000Z',
    message: message(id),
  });
  const shown = ['a', 'b', 'c', 'd', 'e'].map(item);
  const ids = (shownIds: string[], itemIds: string[], untilRefetch = false) =>
    keepShownItems(shownIds.map(item), itemIds.map(item), untilRefetch).map((entry) => entry.id);
  // The window dropped its oldest entries: they stay.
  expect(ids(['a', 'b', 'c'], ['c', 'd'])).toEqual(['a', 'b', 'c', 'd']);
  // A finished reply left the live data: kept in place until the refetched page arrives.
  expect(ids(['a', 'b', 'c'], ['a', 'c', 'd'], true)).toEqual(['a', 'b', 'c', 'd']);
  expect(ids(['a', 'b', 'c'], ['a', 'c', 'd'])).toEqual(['a', 'c', 'd']);
  // Nothing in common (a different page): the new entries as they are.
  expect(ids(['a', 'b'], ['x', 'y'], true)).toEqual(['x', 'y']);
  const same = shown.map((entry) => entry);
  expect(keepShownItems(shown, same, true)).toBe(same);
});
