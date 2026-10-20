import { cancelDeletedJobReviews } from './deep-review-cleanup.ts';
import {
  states,
  type AgentTask,
  type ChatRequest,
  type Conversation,
  type Approval,
  type Card,
  type CardState,
  type ComputerApproval,
  type Routine,
} from '@pitchcrew/core';
import type { Board } from '../index.ts';

const availableCard = (board: Board, cardId: string): Card => {
  const card = board.get<Card>('card', cardId);
  if (board.hasActiveRun(cardId))
    throw new Error('Wait for the application’s active run to finish.');
  return card;
};

const invalidateApprovals = (board: Board, cardId: string, actor: string, now: string): void => {
  for (const approval of board.list<Approval>('approval'))
    if (approval.cardId === cardId && ['pending', 'approved'].includes(approval.status))
      board.record(
        'approval',
        { ...approval, status: 'rejected', decidedAt: now },
        actor,
        'Invalidated packet approval after board change',
      );
  for (const approval of board.list<ComputerApproval>('computer_approval'))
    if (approval.cardId === cardId && ['pending', 'approved'].includes(approval.status))
      board.record(
        'computer_approval',
        { ...approval, status: 'rejected', decidedAt: now },
        actor,
        'Invalidated browser approval after board change',
      );
};

/** Explicit board correction; normal workflow execution still uses Board.move. */
export const changeJobState = (
  board: Board,
  cardId: string,
  state: CardState,
  actor: string,
  reason: string,
): Card => {
  if (!states.includes(state)) throw new Error('Unknown job state.');
  return board.db.transaction(() => {
    const card = availableCard(board, cardId);
    if (card.state === state) return card;
    const now = new Date().toISOString();
    const next: Card = { ...card, state, owner: null, updatedAt: now, statusEffectiveAt: now };
    board.record('card', next, actor, reason);
    invalidateApprovals(board, cardId, actor, now);
    return next;
  })();
};

/** Remove the current card while preserving its complete append-only history. */
export const deleteJob = (board: Board, cardId: string, actor: string, reason: string): void => {
  board.db.transaction(() => {
    const card = availableCard(board, cardId);
    const now = new Date().toISOString();
    board.record('card', { ...card, owner: null, deletedAt: now, updatedAt: now }, actor, reason);
    cancelDeletedJobReviews(board, cardId, actor, now);
    invalidateApprovals(board, cardId, actor, now);
    const threads = new Set(
      board
        .list<Conversation>('conversation')
        .filter((c) => c.cardId === cardId)
        .map((c) => c.id),
    );
    for (const request of board.list<ChatRequest>('chat_request'))
      if (
        threads.has(request.threadId) &&
        request.deliveries.some((d) => ['queued', 'paused', 'failed', 'waiting'].includes(d.status))
      )
        board.record(
          'chat_request',
          {
            ...request,
            deliveries: request.deliveries.map((d) =>
              ['completed', 'cancelled'].includes(d.status)
                ? d
                : { ...d, status: 'cancelled' as const, error: 'The attached job was deleted.' },
            ),
          },
          actor,
          'Cancelled queued request for deleted job',
        );

    for (const task of board.list<AgentTask>('task'))
      if (task.cardId === cardId && task.status === 'queued')
        board.record(
          'task',
          { ...task, status: 'cancelled', error: 'The attached job was deleted.' },
          actor,
          'Cancelled follow-up for deleted job',
        );
    for (const routine of board.list<Routine>('routine'))
      if (routine.cardId === cardId && !routine.deletedAt && routine.enabled)
        board.record(
          'routine',
          {
            ...routine,
            enabled: false,
            nextRunAt: null,
            updatedBy: actor,
            updatedAt: now,
            error: 'The attached job was deleted.',
          },
          actor,
          'Paused routine for deleted job',
        );
  })();
};
