import { describe, expect, it } from 'vitest';
import type { ChatRequest } from '@pitchcrew/core';
import {
  canEditQueuedMessage,
  hasMixedDeliveryState,
  hasNewQueueAttention,
  queueAttentionKeys,
  queueCountLabel,
  queueStateLabel,
} from '../queue-presentation.ts';

const request = (
  id: string,
  deliveries: ChatRequest['deliveries'] = [
    { roleId: 'scout', status: 'paused', runId: null, error: '' },
  ],
): ChatRequest => ({
  id,
  threadId: 'thread',
  messageId: id,
  content: 'A saved message\nwith another line.',
  attachments: [],
  createdAt: '2026-11-06T16:00:00Z',
  order: 1,
  deliveries,
});

describe('truthful queued message presentation', () => {
  it('explains a held message after sending without hiding a real failure', () => {
    const queued = request('queued', [
      { roleId: 'scout', status: 'queued', runId: null, error: '' },
    ]);
    expect(queueStateLabel(undefined, [queued], true)).toBe('After your answer');
    expect(queueStateLabel(undefined, [queued])).toBe('Waiting');
    const failed = request('failed', [
      { roleId: 'scout', status: 'failed', runId: 'run', error: 'Needs recovery' },
    ]);
    expect(queueStateLabel(undefined, [failed], true)).toBe('Needs attention');
  });
  it('calls only completely unstarted messages not sent, including mixed group delivery', () => {
    expect(queueCountLabel([request('a'), request('b'), request('c')])).toBe('3 not sent');
    const partial = request('a', [
      { roleId: 'scout', status: 'completed', runId: 'run', error: '' },
      { roleId: 'writer', status: 'paused', runId: null, error: '' },
    ]);
    expect(queueCountLabel([partial])).toBe('1 pending message');
    expect(queueCountLabel([partial, request('b')])).toBe('2 pending messages');
    expect(canEditQueuedMessage(partial)).toBe(false);
    expect(canEditQueuedMessage(request('b'))).toBe(true);
    expect(canEditQueuedMessage({ ...request('b'), userInputId: 'saved-answer' })).toBe(false);
  });
  it('opens only new attention, keeping collapse when rows reorder or earlier attention disappears', () => {
    const first = request('a');
    const second = request('b');
    const seen = queueAttentionKeys([first, second]);
    expect(hasNewQueueAttention(seen, queueAttentionKeys([second, first]))).toBe(false);
    expect(hasNewQueueAttention(seen, queueAttentionKeys([first]))).toBe(false);
    expect(hasNewQueueAttention(seen, queueAttentionKeys([first, second, request('new')]))).toBe(
      true,
    );
    const failed = request('b', [
      { roleId: 'scout', status: 'failed', runId: 'run', error: 'First failure' },
    ]);
    expect(hasNewQueueAttention(seen, queueAttentionKeys([failed]))).toBe(true);
    const changedError = {
      ...failed,
      deliveries: [{ ...failed.deliveries[0]!, error: 'Another failure' }],
    };
    expect(
      hasNewQueueAttention(queueAttentionKeys([failed]), queueAttentionKeys([changedError])),
    ).toBe(true);
    expect(queueAttentionKeys([failed]).join()).not.toContain('First failure');
  });
  it('suppresses repeated uniform delivery labels but retains mixed states and failures', () => {
    const uniform = request(
      'a',
      ['scout', 'writer'].map((roleId) => ({ roleId, status: 'paused', runId: null, error: '' })),
    );
    expect(hasMixedDeliveryState(uniform)).toBe(false);
    expect(
      hasMixedDeliveryState({
        ...uniform,
        deliveries: [uniform.deliveries[0]!, { ...uniform.deliveries[1]!, status: 'completed' }],
      }),
    ).toBe(true);
    expect(
      hasMixedDeliveryState(
        request('failed', [
          { roleId: 'scout', status: 'failed', runId: 'run', error: 'Needs recovery' },
        ]),
      ),
    ).toBe(true);
  });
});
