import type {
  AgentTask,
  ChatRequest,
  DeepReview,
  Routine,
  Run,
  UserInputRequest,
} from '@pitchcrew/core';
import { conversation } from './conversations.ts';
import type { CrewContext } from './types.ts';

/** User-only removal; append-only events and separately saved agent memories remain intact. */
export function deleteConversation(context: CrewContext, id: string): { ok: true } {
  context.board.db.transaction(() => {
    const current = conversation(context, id);
    const runs = context.board.list<Run>('run');
    const roots = new Set(
      runs.filter((run) => run.threadId === id).map((run) => run.rootRunId ?? run.id),
    );
    const tasks = context.board
      .list<AgentTask>('task')
      .filter((task) => task.threadId === id || roots.has(task.rootRunId));
    if (
      runs.some(
        (run) =>
          (run.threadId === id || roots.has(run.rootRunId ?? run.id)) &&
          ['running', 'waiting'].includes(run.status),
      ) ||
      tasks.some((task) => ['running', 'waiting'].includes(task.status)) ||
      context.board
        .list<ChatRequest>('chat_request')
        .some(
          (request) =>
            request.threadId === id &&
            request.deliveries.some((delivery) => ['running', 'waiting'].includes(delivery.status)),
        ) ||
      context.board
        .list<UserInputRequest>('user_input')
        .some((q) => q.status === 'pending' && (q.threadId === id || q.sourceThreadId === id)) ||
      context.board
        .list<DeepReview>('deep_review')
        .some(
          (review) =>
            (review.threadId === id || review.sourceThreadId === id) &&
            ['running', 'waiting'].includes(review.status),
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
        request.deliveries.some((delivery) =>
          ['queued', 'paused', 'failed'].includes(delivery.status),
        )
      )
        context.board.record(
          'chat_request',
          {
            ...request,
            deliveries: request.deliveries.map((delivery) =>
              ['queued', 'paused', 'failed'].includes(delivery.status)
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
}
