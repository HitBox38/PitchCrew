import {
  jobDetailsChanges,
  type Approval,
  type Card,
  type ComputerApproval,
  type Run,
  type SubmissionAttempt,
} from '@pitchcrew/core';
import type { Board } from '../index.ts';
import { jobSourceRevision } from './application-context.ts';

/** The editing chat may update its own card; other active work must finish first. */
export function assertJobDetailsChange(board: Board, cardId: string, runId: string): Card {
  const card = board.get<Card>('card', cardId);
  if (card.deletedAt) throw new Error('This job was deleted.');
  if (
    card.owner ||
    board
      .list<Run>('run')
      .some(
        (run) =>
          run.cardId === cardId &&
          run.status === 'running' &&
          (run.id !== runId || run.mode !== 'chat' || !!run.purpose),
      ) ||
    board
      .list<SubmissionAttempt>('submission_attempt')
      .some((attempt) => attempt.cardId === cardId && attempt.status === 'uncertain')
  )
    throw new Error(
      'Finish active job work and resolve uncertain submissions before updating this job.',
    );
  return card;
}

/** Caller holds the transaction that checked ownership and the current source. */
export function recordJobSourceChange(
  board: Board,
  card: Card,
  next: Card,
  actor: string,
  reason: string,
): Card {
  if (jobSourceRevision(next) === jobSourceRevision(card)) return card;
  const now = new Date().toISOString();
  const saved: Card = {
    ...next,
    updatedAt: now,
    fit: null,
    applicationContext: undefined,
    packetContextRevision: undefined,
    packetReview: undefined,
    formAssessments: undefined,
  };
  board.record('card', saved, actor, reason);
  for (const approval of board.list<Approval>('approval'))
    if (approval.cardId === card.id && ['pending', 'approved'].includes(approval.status))
      board.record(
        'approval',
        { ...approval, status: 'rejected', decidedAt: now },
        actor,
        'Invalidated export approval after job details changed',
      );
  for (const approval of board.list<ComputerApproval>('computer_approval'))
    if (approval.cardId === card.id && ['pending', 'approved'].includes(approval.status))
      board.record(
        'computer_approval',
        { ...approval, status: 'rejected', decidedAt: now },
        actor,
        'Invalidated browser approval after job details changed',
      );
  return saved;
}

export function updateJobDetails(
  board: Board,
  cardId: string,
  data: unknown,
  actor: string,
  runId: string,
  reason: string,
): Card {
  const changes = jobDetailsChanges.parse(data);
  return board.db.transaction(() => {
    const card = assertJobDetailsChange(board, cardId, runId);
    const next = { ...card };
    for (const key of ['company', 'title', 'location', 'salary'] as const)
      if (changes[key] !== undefined) next[key] = changes[key];
    return recordJobSourceChange(board, card, next, actor, reason);
  })();
}
