import { Board } from '../src/index.ts';
import { conversationTranscriptIndex } from '../src/board/transcript-messages.ts';
import { afterEach, expect, it, vi } from 'vitest';

let board: Board | undefined;
afterEach(() => {
  board?.close();
  vi.restoreAllMocks();
});

it('projects visibility and dispatch metadata in three linear reads without parsing message JSON bodies', () => {
  board = new Board(':memory:');
  const reference = {
    kind: 'agent' as const,
    id: 'coach',
    label: 'Coach',
    token: '@coach',
    start: 0,
    end: 6,
  };
  const message = {
    id: 'canonical',
    threadId: 'group',
    from: 'scout',
    to: 'user',
    runId: 'run',
    cardId: null,
    createdAt: '2026-11-06T12:00:00.000Z',
    content: 'PRIVATE BODY @coach',
    references: [reference],
  };
  board.record('message', message, 'scout', 'Fixture');
  board.record('message', { ...message, id: 'forward', to: 'coach' }, 'scout', 'Fixture');
  board.record(
    'task',
    {
      id: 'task',
      threadId: 'group',
      parentRunId: 'run',
      roleId: 'coach',
      trigger: 'message',
      content: message.content,
    } as never,
    'scout',
    'Fixture',
  );
  board.record(
    'chat_request',
    {
      id: 'request',
      threadId: 'group',
      messageId: 'unsent',
      deliveries: [{ roleId: 'coach', runId: null, status: 'paused', error: 'PRIVATE ERROR' }],
    } as never,
    'user',
    'Fixture',
  );
  const parse = vi.spyOn(JSON, 'parse');
  const get = vi.spyOn(board, 'get');
  const prepare = vi.spyOn(board.db, 'prepare');
  const index = conversationTranscriptIndex(board, 'group');
  expect([...index.hidden]).toEqual(['forward']);
  expect(index.messages.map((item) => item.id)).toEqual(['canonical', 'forward']);
  expect(index.requests).toEqual([
    { id: 'request', messageId: 'unsent', deliveries: [{ runId: null, status: 'paused' }] },
  ]);
  expect(get).not.toHaveBeenCalled();
  expect(prepare).toHaveBeenCalledTimes(3);
  expect(
    parse.mock.calls.every(
      ([json]) => !json.includes('PRIVATE BODY') && !json.includes('PRIVATE ERROR'),
    ),
  ).toBe(true);
  expect(
    prepare.mock.calls.every(
      ([sql]) => !sql.includes('JOIN entities') && !sql.includes('SELECT json FROM'),
    ),
  ).toBe(true);
});
