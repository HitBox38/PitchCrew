import { states, type Approval, type Card, type CardState, type Run } from '@pitchcrew/core';
import type { Board } from '../index.ts';

/** User-only bookkeeping; never launches work, exports a packet or submits an application. */
export function setCardStatus(board: Board, id: string, state: CardState): Card {
  if (!states.includes(state)) throw new Error('Unknown job status.');
  return board.db.transaction(() => {
    const card = board.get<Card>('card', id);
    if (
      card.owner ||
      board.list<Run>('run').some((run) => run.cardId === id && run.status === 'running')
    )
      throw new Error('Wait for the active run or cancel it before moving this card.');
    if (card.state === state) return card;
    const now = new Date().toISOString();
    const next = { ...card, state, updatedAt: now, statusEffectiveAt: now };
    board.record('card', next, 'user', `User changed status to ${state.replaceAll('_', ' ')}`);
    for (const approval of board.list<Approval>('approval')) {
      if (approval.cardId !== id || !['pending', 'approved'].includes(approval.status)) continue;
      board.record(
        'approval',
        { ...approval, status: 'rejected', decidedAt: now },
        'user',
        'Invalidated approval after a manual status change',
      );
    }
    return next;
  })();
}
