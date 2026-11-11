import { deliveryLifecycle } from '@pitchcrew/core';
import type { ChatRequest, AgentTask } from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';
import { canReadConversation } from '../conversations.ts';
import { saveRequest } from '../conversation-queue.ts';
import { ensureQueue, nextOrder, patchQueue, queueRequests, taskLane } from './state.ts';

/** Retry one reviewed head request, then continue messages that have never started. */
export const resumeHeadRequest = (context: CrewContext, request: ChatRequest) => {
  const queue = ensureQueue(context, request.threadId, request.rootRunId);
  const pending = queueRequests(context, queue.id);
  if (pending[0]?.id !== request.id)
    throw new Error('Resume the earlier message first, or choose Send now and resume queue.');
  if (
    context.board
      .list<AgentTask>('task')
      .some((task) => task.status === 'failed' && taskLane(context, task) === queue.id)
  )
    throw new Error('Retry or skip the failed crew follow-up in Queue before continuing.');
  const eligible = request.deliveries.filter(
    (delivery) =>
      deliveryLifecycle.is('stopped', delivery.status) &&
      canReadConversation(context, delivery.roleId, request.threadId),
  );
  if (!eligible.length) throw new Error('This message has no unfinished replies to resume.');
  context.board.db.transaction(() => {
    for (const delivery of eligible) {
      delivery.status = 'queued';
      delivery.runId = null;
      delivery.error = '';
    }
    saveRequest(context, request);
    for (const later of pending.slice(1)) {
      let changed = false;
      for (const delivery of later.deliveries)
        if (delivery.status === 'paused' && !delivery.runId) {
          delivery.status = 'queued';
          changed = true;
        }
      if (changed) saveRequest(context, later);
    }
    patchQueue(context, queue.id, {
      paused: false,
      pauseKind: undefined,
      reason: '',
      order: nextOrder(context),
    });
  })();
};

/** A different failed attempt is still a user decision, never an implicit bulk retry. */
export const pauseForUnfinishedHead = (context: CrewContext, request: ChatRequest) => {
  if (
    request.deliveries.some((delivery) =>
      ['queued', 'running', 'waiting'].includes(delivery.status),
    )
  )
    return;
  const failed = request.deliveries.some((delivery) => delivery.status === 'failed');
  const paused = request.deliveries.filter((delivery) => delivery.status === 'paused');
  if (!failed && !paused.length) return;
  const interrupted = paused.some((delivery) => !!delivery.runId);
  const queue = ensureQueue(context, request.threadId, request.rootRunId);
  if (queue.paused) return;
  patchQueue(context, queue.id, {
    paused: true,
    pauseKind: failed ? 'failed' : interrupted ? 'interrupted' : 'user',
    reason:
      failed || interrupted
        ? 'Review the unfinished message before continuing.'
        : 'Resume the paused queue to send waiting messages.',
  });
};
