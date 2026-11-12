import type { ChatRequest } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import { editorRequest, queuedChatRequests } from '../helpers.ts';

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

it('keeps the text of an open editor when the compact snapshot blanks its settled request', () => {
  const kept = { ...request('edit', ['queued']), content: 'Draft text' };
  expect(editorRequest(kept, undefined)).toBe(kept);
  const full = { ...kept, content: 'Saved edit' };
  expect(editorRequest(kept, full)).toBe(full);
  const compact: ChatRequest = {
    ...kept,
    content: '',
    compact: true,
    deliveries: request('edit', ['completed']).deliveries,
  };
  expect(editorRequest(kept, compact)).toEqual({ ...kept, deliveries: compact.deliveries });
});
