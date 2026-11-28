import type { ChatRequest, Conversation, Run } from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';
import { runIsDelegate } from '../delegation-rounds.ts';
import { pauseForUnfinishedHead } from './recovery.ts';
import {
  activeQueues,
  ensureQueue,
  laneId,
  nextOrder,
  patchQueue,
  queueRequests,
  runLane,
  saveRequest,
} from './state.ts';

const finishQueueRun = (context: CrewContext, run: Run): void => {
  const finished = context.board.get<Run>('run', run.id);
  const thread = run.threadId;
  if (!thread || !context.board.list<Conversation>('conversation').some((c) => c.id === thread))
    return;
  const scope = runLane(context, run);
  // A failed or stopped delegate is a result for the lead: the round keeps its admitted chain and
  // the lane stays running so the collection turn can start once every delegate settles.
  const delegate = runIsDelegate(context, finished);
  if (
    finished.status === 'waiting' ||
    (['failed', 'cancelled'].includes(finished.status) && !delegate)
  )
    context.queueChains.delete(scope);
  if (scope.startsWith('routine:')) return;
  const queue = ensureQueue(context, thread, run.rootRunId);
  if (finished.status === 'failed' && !delegate)
    patchQueue(context, queue.id, { paused: true, pauseKind: 'failed', reason: finished.message });
  else if (!activeQueues(context).has(queue.id))
    patchQueue(context, queue.id, { order: nextOrder(context) });
};

export const finishDelivery = (context: CrewContext, run: Run): void => {
  finishQueueRun(context, run);
  if (!run.requestId) return;
  const request = context.board.get<ChatRequest>('chat_request', run.requestId);
  const delivery = request.deliveries.find((entry) => entry.roleId === run.roleId);
  const finished = context.board.get<Run>('run', run.id);
  if (delivery?.status === 'running') {
    delivery.status =
      finished.status === 'waiting'
        ? 'waiting'
        : finished.status === 'completed'
          ? 'completed'
          : finished.status === 'cancelled'
            ? 'paused'
            : 'failed';
    delivery.error = finished.status === 'failed' ? finished.message : '';
    saveRequest(context, request);
    const head = queueRequests(context, laneId(context, request.threadId, request.rootRunId))[0];
    if (head) pauseForUnfinishedHead(context, head);
  }
};
