import { expect, it } from 'vitest';
import type { ChatMessage, ConversationHistoryPage } from '@pitchcrew/core';
import { liveHistoryItems } from '../remote-history.ts';

function message(id: string, from = 'scout'): ChatMessage {
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
}
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
