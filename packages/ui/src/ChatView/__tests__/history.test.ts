import type { ChatMessage, Run } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import { transcriptItems } from '../../ChatTurn/helpers.ts';
import { HISTORY_PAGE_SIZE, historyWindow } from '../history.ts';

const messages: ChatMessage[] = Array.from({ length: 137 }, (_, index) => ({
  id: `message-${index}`,
  threadId: 'scout',
  from: index % 2 ? 'scout' : 'user',
  to: 'scout',
  content: `Message ${index}`,
  runId: null,
  cardId: null,
  createdAt: new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString(),
}));
const items = transcriptItems(messages, [], 'scout');

it('opens on a bounded latest page and handles empty, short and missing-anchor histories', () => {
  expect(historyWindow(items, null)).toMatchObject({ start: 87, end: 137, latest: true });
  expect(historyWindow(items, null).items).toHaveLength(HISTORY_PAGE_SIZE);
  expect(historyWindow([], null).items).toEqual([]);
  expect(historyWindow(items.slice(0, 3), null)).toMatchObject({
    start: 0,
    end: 3,
    older: null,
    newer: null,
  });
  expect(historyWindow(items, 'deleted').items).toEqual(historyWindow(items, null).items);
});

it('makes every entry reachable in both directions, including partial edge pages', () => {
  const seen = new Set<string>();
  let page = historyWindow(items, null);
  while (true) {
    page.items.forEach((item) => seen.add(item.id));
    expect(page.items.length).toBeLessThanOrEqual(HISTORY_PAGE_SIZE);
    if (!page.older) break;
    page = historyWindow(items, page.older);
  }
  expect(seen).toEqual(new Set(items.map((item) => item.id)));
  const newer = new Set<string>();
  while (true) {
    page.items.forEach((item) => newer.add(item.id));
    if (!page.newer) break;
    page = historyWindow(items, page.newer);
  }
  expect(newer).toEqual(seen);
});

it('keeps older-page identities and streaming content while new messages arrive', () => {
  const page = historyWindow(items, items[20].id);
  const question = { ...messages[30], userInput: { id: 'question', kind: 'question' as const } };
  const updated = messages.map((message) => (message.id === question.id ? question : message));
  updated.push({ ...messages[136], id: 'streaming', content: 'Partial reply' });
  const next = transcriptItems(updated, [], 'scout');
  expect(historyWindow(next, items[20].id).items.map((item) => item.id)).toEqual(
    page.items.map((item) => item.id),
  );
  expect(historyWindow(next, null).items.at(-1)).toMatchObject({
    message: { content: 'Partial reply' },
  });
  expect(historyWindow(next, items[20].id).items).toContainEqual(
    expect.objectContaining({ message: question }),
  );
});

it('pages turn activity, trigger messages, day boundaries and replies without dropping context', () => {
  const trigger = { ...messages[49], from: 'user', runId: 'turn' };
  const reply = { ...messages[50], runId: 'turn' };
  const run = {
    id: 'turn',
    mode: 'chat',
    status: 'running',
    threadId: 'scout',
    startedAt: trigger.createdAt,
  } as Run;
  const withTurn = transcriptItems(
    [...messages.slice(0, 49), trigger, reply, ...messages.slice(51)],
    [run],
    'scout',
  );
  const first = historyWindow(withTurn, withTurn[0].id);
  const second = historyWindow(withTurn, first.newer);
  expect(first.items.at(-1)?.id).toBe(trigger.id);
  expect(second.items.slice(0, 2).map((item) => item.id)).toEqual(['turn-turn', reply.id]);
  expect(
    [...first.items, ...second.items].filter((item) =>
      ['turn-turn', trigger.id, reply.id].includes(item.id),
    ),
  ).toHaveLength(3);
});
