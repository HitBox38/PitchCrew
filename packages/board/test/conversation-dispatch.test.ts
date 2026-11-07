import { afterEach, beforeEach, expect, it } from 'vitest';
import type { ChatMessage, ChatRequest, Run } from '@pitchcrew/core';
import { Board, conversationHistory, searchConversationMessages } from '../src/index.ts';
import { transcriptItems } from '../../ui/src/ChatTurn/helpers.ts';
import { liveHistoryItems } from '../../ui/src/ChatView/remote-history.ts';

let board: Board;
beforeEach(() => {
  board = new Board(':memory:');
});
afterEach(() => board.close());
const at = (second: number) => new Date(Date.UTC(2026, 10, 6, 12, 0, second)).toISOString();
const message = (
  id: string,
  second: number,
  from = 'user',
  runId: string | null = null,
): ChatMessage => {
  const item: ChatMessage = {
    id,
    threadId: 'group',
    from,
    to: from === 'user' ? 'crew' : 'user',
    content: id,
    cardId: null,
    runId,
    createdAt: at(second),
  };
  board.record('message', item, 'user', 'Fictional chronology fixture');
  return item;
};
const run = (
  id: string,
  second: number,
  requestId?: string,
  status: Run['status'] = 'completed',
  roleId = 'scout',
): Run => {
  const item: Run = {
    id,
    roleId,
    runtime: 'codex',
    threadId: 'group',
    mode: 'chat',
    cardId: null,
    status,
    message: '',
    startedAt: at(second),
    finishedAt: at(second),
    requestId,
    activity: [
      {
        id: `${id}-step`,
        kind: 'tool',
        label: 'Fictional step',
        status: 'completed',
        startedAt: at(second),
        finishedAt: at(second),
      },
    ],
  };
  board.record('run', item, 'user', 'Fictional chronology fixture');
  return item;
};
const request = (
  id: string,
  input: ChatMessage,
  deliveries: ChatRequest['deliveries'],
): ChatRequest => {
  const item: ChatRequest = {
    id,
    threadId: 'group',
    messageId: input.id,
    content: input.content,
    attachments: [],
    createdAt: input.createdAt,
    order: 0,
    deliveries,
  };
  board.record('chat_request', item, 'user', 'Fictional chronology fixture');
  return item;
};
const delivery = (
  runId: string | null,
  roleId = 'scout',
  status: ChatRequest['deliveries'][number]['status'] = 'completed',
) => ({ runId, roleId, status, error: '' });
const parity = (messages: ChatMessage[], runs: Run[], requests: ChatRequest[]) => {
  const expected = transcriptItems(messages, runs, 'group', { requests });
  const page = conversationHistory(board, 'group');
  expect(page.items).toEqual(expected.slice(-50));
  expect(liveHistoryItems(page, [], runs, 'group', { requests })).toEqual(page.items);
  return page;
};

it.each(['running', 'waiting', 'completed', 'failed', 'cancelled'] as const)(
  'uses dispatch chronology consistently in saved/live history after queued delivery becomes %s',
  (status) => {
    const m1 = message('m1', 0),
      m2 = message('m2', 2),
      r1 = message('r1', 5, 'scout', 'a');
    const runs = [run('a', 0, 'request-a'), run('b', 6, 'request-b', status)];
    const messages = [m1, m2, r1];
    if (status === 'completed') messages.push(message('r2', 9, 'scout', 'b'));
    const requests = [
      request('request-a', m1, [delivery('a')]),
      request('request-b', m2, [delivery('b', 'scout', status)]),
    ];
    const page = parity(messages, runs, requests);
    expect(page.items.map((item) => item.id)).toEqual([
      'm1',
      'turn-a',
      'r1',
      'm2',
      'turn-b',
      ...(status === 'completed' ? ['r2'] : []),
    ]);
    expect(page.items.find((item) => item.id === 'm2')?.createdAt).toBe(at(6));
    expect(board.get<ChatMessage>('message', 'm2').createdAt).toBe(at(2));
  },
);

it('keeps a resumed group input once above the first dispatched recipient and each settled pair intact', () => {
  const input = message('m2', 2),
    previous = message('r1', 5, 'scout', 'a');
  const coachReply = message('coach-reply', 9, 'coach', 'c'),
    scoutReply = message('scout-reply', 10, 'scout', 'b');
  const runs = [
    run('a', 0),
    run('c', 8, 'request-b', 'completed', 'coach'),
    run('b', 6, 'request-b'),
  ];
  const requests = [request('request-b', input, [delivery('c', 'coach'), delivery('b')])];
  expect(
    parity([input, previous, coachReply, scoutReply], runs, requests).items.map((item) => item.id),
  ).toEqual(['turn-a', 'r1', 'm2', 'turn-c', 'coach-reply', 'turn-b', 'scout-reply']);
});

it('retains first dispatch during retry reservation and after pointers move to a later attempt', () => {
  const input = message('m2', 2),
    previous = message('r1', 5, 'scout', 'a');
  const runs = [run('a', 0), run('first-attempt', 6, 'request-b', 'failed')];
  const retry = request('request-b', input, [delivery(null, 'scout', 'queued')]);
  expect(parity([input, previous], runs, [retry]).items.map((item) => item.id)).toEqual([
    'turn-a',
    'r1',
    'm2',
    'turn-first-attempt',
  ]);
  runs.push(run('retry', 10, 'request-b', 'running'));
  retry.deliveries = [delivery('retry', 'scout', 'running')];
  board.record('chat_request', retry, 'user', 'Fictional retry fixture');
  const page = parity([input, previous], runs, [retry]);
  expect(page.items.find((item) => item.id === input.id)?.createdAt).toBe(at(6));
  expect(liveHistoryItems(page, [], [runs[2]], 'group', { requests: [retry] })).toEqual(page.items);
});

it('uses silent completed runs as dispatch evidence without adding empty activity rows', () => {
  const input = message('m2', 2),
    previous = message('r1', 5, 'scout', 'a');
  const first = { ...run('first', 6, 'request-b'), activity: undefined };
  board.record('run', first, 'user', 'Fictional legacy run fixture');
  const runs = [run('a', 0), first, run('retry', 10, 'request-b', 'failed')];
  const requests = [request('request-b', input, [delivery('retry', 'scout', 'failed')])];
  const page = parity([input, previous], runs, requests);
  expect(page.items.map((item) => item.id)).toEqual(['turn-a', 'r1', 'm2', 'turn-retry']);
  expect(page.items.find((item) => item.id === input.id)?.createdAt).toBe(at(6));
});

it('folds the exact redundant cancellation note while preserving its saved record and searchability', () => {
  const note = { ...message('note', 7, 'system', 'b'), content: 'Run cancelled.' };
  board.record('message', note, 'user', 'Fictional cancellation fixture');
  const other = { ...message('other', 8, 'system', 'b'), content: 'Useful diagnostic.' };
  board.record('message', other, 'user', 'Fictional diagnostic fixture');
  expect(
    parity([note, other], [run('b', 6, undefined, 'cancelled')], []).items.map((item) => item.id),
  ).toEqual(['turn-b', 'other']);
  expect(board.get<ChatMessage>('message', 'note')).toEqual(note);
  expect(searchConversationMessages(board, 'Run cancelled.')).toEqual(['group']);
});

it('pages dispatched inputs and settled pairs in both directions and keeps exact run anchors reachable', () => {
  const messages: ChatMessage[] = [],
    runs: Run[] = [],
    requests: ChatRequest[] = [];
  for (let index = 0; index < 55; index++) {
    const input = message(`m${index}`, 0),
      id = `run${index}`;
    messages.push(input, message(`r${index}`, index * 3 + 2, 'scout', id));
    runs.push(run(id, index * 3 + 1, `request${index}`));
    requests.push(request(`request${index}`, input, [delivery(id)]));
  }
  const expected = transcriptItems(messages, runs, 'group', { requests });
  let page = conversationHistory(board, 'group', expected[0].id);
  const seen = [...page.items];
  while (page.newer) {
    page = conversationHistory(board, 'group', page.newer);
    expect(page.items.length).toBeLessThanOrEqual(51);
    seen.push(...page.items);
  }
  expect(seen).toEqual(expected);
  const backwards = new Set(page.items.map((item) => item.id));
  while (page.older) {
    page = conversationHistory(board, 'group', page.older);
    page.items.forEach((item) => backwards.add(item.id));
  }
  expect(backwards).toEqual(new Set(expected.map((item) => item.id)));
  expect(conversationHistory(board, 'group', 'turn-run20').items[0].id).toBe('turn-run20');
});
