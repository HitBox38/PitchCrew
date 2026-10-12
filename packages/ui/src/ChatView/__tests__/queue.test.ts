import type { ChatRequest } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import { queuedChatRequests } from '../helpers.ts';

const request = (
  id: string,
  statuses: ChatRequest['deliveries'][number]['status'][],
  order = 0,
): ChatRequest => ({
  id,
  threadId: 'chat',
  messageId: id,
  content: 'Follow-up',
  attachments: [],
  createdAt: '',
  order,
  deliveries: statuses.map((status, index) => ({
    roleId: `agent-${index}`,
    status,
    runId: null,
    error: '',
  })),
});

it('does not repeat the current turn or completed deliveries in the follow-up queue', () => {
  const requests = [
    request('active', ['running']),
    request('finished', ['completed']),
    request('question', ['waiting']),
    request('stopped', ['cancelled']),
    request('group-active', ['running', 'completed']),
  ];
  expect(queuedChatRequests(requests, 'chat')).toEqual([]);
});

it('preserves actionable queued, paused, failed and partially delivered requests in order', () => {
  const paused = request('paused', ['paused'], 3);
  const failed = request('failed', ['failed'], 2);
  const mixed = request('mixed', ['running', 'queued'], 1);
  const unrelated = { ...request('unrelated', ['queued']), threadId: 'other' };
  const input = [paused, unrelated, failed, mixed];
  expect(queuedChatRequests(input, 'chat')).toEqual([mixed, failed, paused]);
  expect(input).toEqual([paused, unrelated, failed, mixed]);
});
