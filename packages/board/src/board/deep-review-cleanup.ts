import type { ChatRequest, DeepReview, Run, UserInputRequest } from '@pitchcrew/core';
import type { Board } from '../index.ts';
/** Called inside job deletion's transaction; running workflows are rejected before this point. */
export function cancelDeletedJobReviews(board: Board, cardId: string, actor: string, now: string) {
  const reason = 'The attached job was deleted.';
  const ids = new Set(
    board
      .list<DeepReview>('deep_review')
      .filter((review) => review.cardId === cardId && review.status === 'waiting')
      .map((review) => {
        board.record(
          'deep_review',
          { ...review, status: 'cancelled', summary: reason, updatedAt: now, finishedAt: now },
          actor,
          'Cancelled waiting review for deleted job',
        );
        return review.id;
      }),
  );
  const runs = board.list<Run>('run');
  for (const run of runs)
    if (run.deepReviewId && ids.has(run.deepReviewId) && run.status === 'waiting')
      board.record(
        'run',
        { ...run, status: 'cancelled', message: reason, finishedAt: now },
        actor,
        reason,
      );
  for (const question of board.list<UserInputRequest>('user_input'))
    if (
      question.status === 'pending' &&
      runs.some((run) => run.id === question.runId && run.deepReviewId && ids.has(run.deepReviewId))
    )
      board.record(
        'user_input',
        { ...question, status: 'cancelled', cancellationReason: reason },
        actor,
        reason,
      );
  for (const request of board.list<ChatRequest>('chat_request'))
    if (
      request.deepReviewRequest?.cardId === cardId &&
      request.deliveries.some((delivery) =>
        ['queued', 'paused', 'waiting'].includes(delivery.status),
      )
    )
      board.record(
        'chat_request',
        {
          ...request,
          deliveries: request.deliveries.map((delivery) =>
            ['queued', 'paused', 'waiting'].includes(delivery.status)
              ? { ...delivery, status: 'cancelled' as const, error: reason }
              : delivery,
          ),
        },
        actor,
        'Cancelled queued deep review for deleted job',
      );
}
