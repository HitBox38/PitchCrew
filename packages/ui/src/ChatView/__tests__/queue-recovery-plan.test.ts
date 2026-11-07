import { expect, it } from 'vitest';
import type { ChatRequest, WorkQueueView } from '@pitchcrew/core';
import { conversationQueueHold, queueRecoveryPlan } from '../queue-recovery-plan.ts';
import { conversationQueue, queueCountLabel } from '../queue-presentation.ts';
import { queueRowState } from '../queue-row-state.ts';

const request = (
  id: string,
  threadId = 'current',
  runId: string | null = 'attempt',
): ChatRequest => ({
  id,
  threadId,
  messageId: id,
  content: 'Saved request',
  attachments: [],
  createdAt: '',
  order: 0,
  deliveries: [{ roleId: 'scout', status: 'paused', runId, error: '' }],
});
const queue = (requests: ChatRequest[], patch: Partial<WorkQueueView> = {}): WorkQueueView => ({
  id: 'job:job',
  cardId: 'job',
  threadId: 'other',
  paused: true,
  pauseKind: 'interrupted',
  reason: '',
  order: 0,
  updatedAt: '',
  title: 'Shared job',
  state: 'paused',
  requests,
  runs: [],
  tasks: [],
  ...patch,
});

it('links to the actual blocking conversation instead of offering a local non-head retry', () => {
  const head = request('head', 'other');
  const local = request('local', 'current', null);
  const shared = queue([head, local]);
  const conversations = [{ id: 'other', title: 'Earlier job discussion' }];
  expect(queueRecoveryPlan(shared, [local], 'current', conversations)).toMatchObject({
    kind: 'chat',
    thread: 'other',
    label: 'Open blocking chat',
    hold: 'review',
    explanation:
      'This job’s queue is waiting on Earlier job discussion. Review its unfinished message first.',
  });
  expect(queueRecoveryPlan(shared, [head], 'other', conversations)).toMatchObject({
    kind: 'request',
    request: head,
    path: '/chat-requests/head',
    hold: 'retry',
    label: 'Retry',
  });
  const data = { queue: { queues: [shared] }, runs: [] } as never;
  expect(queueRowState(local, data).canResume).toBe(false);
  expect(conversationQueueHold({ queue: { queues: [shared] } } as never, 'current')).toBe('review');
});

it('uses Queue when the head conversation is missing or a failed crew follow-up blocks recovery', () => {
  const head = request('head', 'other');
  const local = request('local', 'current', null);
  expect(queueRecoveryPlan(queue([head, local]), [local], 'current')).toMatchObject({
    kind: 'queue',
    label: 'Open Queue',
    hold: 'review',
  });
  const failedTask = { status: 'failed' } as WorkQueueView['tasks'][number];
  expect(
    queueRecoveryPlan(
      queue([local], { pauseKind: 'user', tasks: [failedTask] }),
      [local],
      'current',
    ),
  ).toMatchObject({ kind: 'queue', explanation: expect.stringContaining('crew follow-up') });
});

it('preserves explicit user-paused job-wide resume without retrying a stopped head', () => {
  const head = request('head', 'other');
  const local = request('local', 'current', null);
  const shared = queue([head, local], { pauseKind: 'user' });
  expect(queueRecoveryPlan(shared, [local], 'current')).toMatchObject({
    kind: 'resume',
    path: '/queue/job%3Ajob',
    label: 'Resume queue',
    hold: 'resume',
  });
  expect(queueCountLabel([head, local], shared)).toBe('1 waiting · 1 stopped');
  const partial = {
    ...local,
    deliveries: [
      { roleId: 'writer', status: 'completed', runId: 'finished', error: '' },
      ...local.deliveries,
    ],
  } as ChatRequest;
  expect(queueCountLabel([head, partial, request('next', 'current', null)], shared)).toBe(
    '2 waiting · 1 stopped',
  );
  const failed = {
    ...head,
    deliveries: [{ ...head.deliveries[0]!, status: 'failed' }],
  } as ChatRequest;
  expect(
    queueRecoveryPlan(queue([failed, local], { pauseKind: 'user' }), [failed], 'other'),
  ).toMatchObject({ kind: 'request', hold: 'retry' });
});

it('resolves a held job lane for a newly attached conversation with no local requests', () => {
  const head = request('head', 'other');
  const waiting = request('waiting', 'other', null);
  const conversations = [
    { id: 'other', title: 'Earlier discussion', cardId: 'job' },
    { id: 'fresh', title: 'New attached chat', cardId: 'job' },
    { id: 'unrelated', title: 'Other job', cardId: 'different' },
    { id: 'standalone', title: 'Standalone', cardId: null },
  ];
  for (const pauseKind of ['user', 'failed', 'interrupted'] as const) {
    const shared = queue([head, waiting], { pauseKind });
    const workspace = { queues: [shared], concurrency: 5, active: 0, background: 0 };
    expect(conversationQueue(workspace, 'fresh', conversations)).toBe(shared);
    expect(conversationQueue(workspace, 'unrelated', conversations)).toBeUndefined();
    expect(conversationQueue(workspace, 'standalone', conversations)).toBeUndefined();
    expect(conversationQueueHold({ queue: workspace, conversations } as never, 'fresh')).toBe(
      pauseKind === 'user' ? 'resume' : 'review',
    );
    expect(queueRecoveryPlan(shared, [], 'fresh', conversations)).toMatchObject(
      pauseKind === 'user'
        ? { kind: 'resume', label: 'Resume queue' }
        : { kind: 'chat', thread: 'other', label: 'Open blocking chat' },
    );
  }
});
