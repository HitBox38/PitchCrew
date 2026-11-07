import type { AgentTask, ChatMessage, ChatRequest } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import { visibleTranscriptMessages } from '../transcript-messages.ts';

const reply: ChatMessage = {
  id: 'reply',
  threadId: 'group',
  from: 'scout',
  to: 'user',
  content: '@coach Review this.',
  references: [{ kind: 'agent', id: 'coach', label: 'Coach', token: '@coach', start: 0, end: 6 }],
  cardId: null,
  runId: 'run',
  createdAt: '2026-11-06T12:00:00.000Z',
};
const forward = { ...reply, id: 'forward', to: 'coach', createdAt: '2026-11-06T12:00:00.001Z' };
const task: AgentTask = {
  id: 'task',
  parentRunId: 'run',
  rootRunId: 'run',
  roleId: 'coach',
  cardId: null,
  threadId: 'group',
  content: reply.content,
  mode: 'chat',
  trigger: 'message',
  status: 'queued',
  runId: null,
  error: '',
  createdAt: forward.createdAt,
};
it('renders one broadcast for a same-run task forward without changing messages or task delivery', () => {
  const messages = [reply, forward];
  expect(visibleTranscriptMessages(messages, [], [task])).toEqual([reply]);
  expect(messages).toHaveLength(2);
  expect(task.status).toBe('queued');
  const references: ChatMessage['references'] = [
    { kind: 'agent', id: 'coach', label: 'Coach', token: '@coach', start: 0, end: 6 },
  ];
  expect(
    visibleTranscriptMessages(
      [
        { ...reply, references },
        { ...forward, references },
      ],
      [],
      [task],
    ),
  ).toEqual([{ ...reply, references }]);
});
it('preserves intentional repeats, distinct instructions, notifications, references and DMs', () => {
  const repeats: ChatMessage[] = [
    { ...forward, runId: 'later' },
    { ...forward, content: 'Different instruction' },
    { ...forward, threadId: 'dm' },
    { ...forward, notification: 'attention' },
    { ...forward, references: [] },
  ];
  expect(visibleTranscriptMessages([reply, ...repeats], [], [task])).toEqual([reply, ...repeats]);
  expect(visibleTranscriptMessages([reply, forward])).toEqual([reply, forward]);
  const explicit = [
    { ...reply, references: [] },
    { ...forward, references: [] },
  ];
  expect(visibleTranscriptMessages(explicit, [], [task])).toEqual(explicit);
});
it('leaves never-started requests in the queue and retains partially delivered group requests', () => {
  const request = (
    id: string,
    status: 'paused' | 'failed' | 'completed',
    runId: string | null,
  ): ChatRequest => ({
    id,
    messageId: id,
    threadId: 'group',
    content: id,
    attachments: [],
    createdAt: reply.createdAt,
    order: 0,
    deliveries: [{ roleId: 'coach', status, runId, error: '' }],
  });
  const requests = [
    request('paused', 'paused', null),
    request('failed', 'failed', null),
    request('partial', 'completed', 'started'),
    request('stopped', 'paused', 'stopped'),
  ];
  const messages = requests.map((item) => ({ ...reply, from: 'user', id: item.messageId }));
  expect(visibleTranscriptMessages(messages, requests).map((item) => item.id)).toEqual([
    'partial',
    'stopped',
  ]);
});
