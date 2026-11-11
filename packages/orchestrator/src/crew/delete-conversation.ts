import {
  deepReviewLifecycle,
  deliveryLifecycle,
  runLifecycle,
  taskLifecycle,
} from '@pitchcrew/core';
import { runsForThread, runsWithStatus } from '@pitchcrew/board';
import type {
  AgentTask,
  ChatRequest,
  DeepReview,
  Routine,
  UserInputRequest,
} from '@pitchcrew/core';
import { conversation } from './conversations.ts';
import type { CrewContext } from './types.ts';

/** User-only removal; append-only events and separately saved agent memories remain intact. */
export const deleteConversation = (context: CrewContext, id: string): { ok: true } => {
  context.board.db.transaction(() => {
    const current = conversation(context, id);
    const roots = new Set(runsForThread(context.board, id).map((run) => run.rootRunId ?? run.id));
    const tasks = context.board
      .list<AgentTask>('task')
      .filter((task) => task.threadId === id || roots.has(task.rootRunId));
    if (
      runsWithStatus(context.board, runLifecycle.groups.live).some(
        (run) => run.threadId === id || roots.has(run.rootRunId ?? run.id),
      ) ||
      tasks.some((task) => taskLifecycle.is('engaged', task.status)) ||
      context.board
        .list<ChatRequest>('chat_request')
        .some(
          (request) =>
            request.threadId === id &&
            request.deliveries.some((delivery) => deliveryLifecycle.is('engaged', delivery.status)),
        ) ||
      context.board
        .list<UserInputRequest>('user_input')
        .some((q) => q.status === 'pending' && (q.threadId === id || q.sourceThreadId === id)) ||
      context.board
        .list<DeepReview>('deep_review')
        .some(
          (review) =>
            (review.threadId === id || review.sourceThreadId === id) &&
            deepReviewLifecycle.is('live', review.status),
        )
    )
      throw new Error('Stop or finish this conversation’s active work before deleting it.');
    for (const task of tasks)
      if (task.status === 'queued')
        context.board.record(
          'task',
          { ...task, status: 'cancelled', error: 'The conversation was deleted.' },
          'user',
          'Cancelled follow-up for deleted conversation',
        );
    for (const request of context.board.list<ChatRequest>('chat_request'))
      if (
        request.threadId === id &&
        request.deliveries.some((delivery) => deliveryLifecycle.is('unsent', delivery.status))
      )
        context.board.record(
          'chat_request',
          {
            ...request,
            deliveries: request.deliveries.map((delivery) =>
              deliveryLifecycle.is('unsent', delivery.status)
                ? { ...delivery, status: 'cancelled' as const }
                : delivery,
            ),
          },
          'user',
          'Cancelled replies for deleted conversation',
        );
    const now = new Date().toISOString();
    for (const routine of context.board.list<Routine>('routine'))
      if (routine.conversationId === id && !routine.deletedAt && routine.enabled)
        context.board.record(
          'routine',
          {
            ...routine,
            enabled: false,
            nextRunAt: null,
            updatedAt: now,
            updatedBy: 'user',
            error: 'The conversation was deleted.',
          },
          'user',
          'Paused routine for deleted conversation',
        );
    context.board.record(
      'conversation',
      { ...current, deletedAt: now, updatedAt: now },
      'user',
      'Deleted conversation',
    );
  })();
  context.publishChat(true);
  return { ok: true };
};
