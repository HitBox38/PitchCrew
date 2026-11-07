import { expect, it } from 'vitest';
import type { ChatRequest, WorkQueueView } from '@pitchcrew/core';
import { queueExplanation, queueRecoveryRequest, requestRecovery } from '../queue-recovery.ts';

const request = (id: string, deliveries: ChatRequest['deliveries']): ChatRequest => ({
  id,
  threadId: 'thread',
  messageId: id,
  content: 'Saved message',
  attachments: [],
  createdAt: '',
  order: 0,
  deliveries,
});

it('recovers only one affected request and leaves finished recipients out of the decision', () => {
  const completed = request('done', [
    { roleId: 'scout', status: 'completed', runId: 'a', error: '' },
  ]);
  const unstarted = request('next', [
    { roleId: 'scout', status: 'queued', runId: null, error: '' },
  ]);
  const partial = request('partial', [
    { roleId: 'scout', status: 'completed', runId: 'b', error: '' },
    { roleId: 'writer', status: 'paused', runId: null, error: '' },
  ]);
  const failed = request('failed', [
    { roleId: 'scout', status: 'failed', runId: 'c', error: 'Raw failure' },
  ]);
  expect(requestRecovery(completed)).toBeNull();
  expect(requestRecovery(unstarted)).toBeNull();
  expect(queueRecoveryRequest([completed, unstarted, partial, failed])).toBeUndefined();
  expect(queueRecoveryRequest([completed, partial, failed])?.id).toBe('partial');
  expect(queueRecoveryRequest([completed, failed, partial])?.id).toBe('failed');
  expect(requestRecovery(partial)).toMatchObject({ retry: false, label: 'Resume message' });
  expect(requestRecovery(partial)?.description).toContain('Only unfinished replies');
  expect(requestRecovery(failed)).toMatchObject({ retry: true, label: 'Retry unfinished replies' });
});

it('distinguishes interrupted attempts from paused messages that have never started', () => {
  const interrupted = request('interrupted', [
    { roleId: 'scout', status: 'paused', runId: 'run', error: '' },
  ]);
  const paused = request('paused', [{ roleId: 'scout', status: 'paused', runId: null, error: '' }]);
  expect(requestRecovery(interrupted)?.retry).toBe(true);
  expect(requestRecovery(paused)?.retry).toBe(false);
  expect(queueExplanation({ paused: true, pauseKind: 'interrupted' } as WorkQueueView)).toContain(
    'stopped before it finished',
  );
  expect(queueExplanation({ paused: true, pauseKind: 'failed' } as WorkQueueView)).toContain(
    'could not finish',
  );
  expect(
    queueExplanation({ paused: true, pauseKind: 'user', cardId: null } as WorkQueueView),
  ).toContain('Resume all');
});
