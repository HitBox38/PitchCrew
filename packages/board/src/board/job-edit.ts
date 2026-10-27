import { editJobInput, type Card } from '@pitchcrew/core';
import type { Board } from '../index.ts';
import { assertJobDetailsChange, recordJobSourceChange } from './job-details.ts';

/** User edits share source-change gates without widening agent tool permissions. */
export const editJob = (board: Board, cardId: string, data: unknown): Card => {
  const { expectedUpdatedAt, ...fields } = editJobInput.parse(data);
  return board.db.transaction(() => {
    const card = assertJobDetailsChange(board, cardId, '');
    if (card.updatedAt !== expectedUpdatedAt)
      throw new Error('This job changed while you were editing. Reopen the editor to review it.');
    const next = { ...card, ...fields };
    // Captured markup describes the old posting; subsequent extraction must use the edited text.
    if (next.url !== card.url || next.description !== card.description) next.sourceHtml = undefined;
    const saved = recordJobSourceChange(board, card, next, 'user', 'User edited the job');
    if (saved !== card) return saved;
    if (JSON.stringify(card.tags) === JSON.stringify(next.tags)) return card;
    const tagged = { ...next, updatedAt: new Date().toISOString() };
    board.record('card', tagged, 'user', 'User edited job tags');
    return tagged;
  })();
};
