import type { Card } from '@pitchcrew/core';

export type JobReveal = { id: string } | null;

/** A moved card must be mounted before the drag controller restores keyboard focus. */
export function revealedJobPage(cards: Card[], size: number, reveal: JobReveal, fallback = 0) {
  const index = reveal ? cards.findIndex((card) => card.id === reveal.id) : -1;
  return index >= 0 ? Math.floor(index / size) : fallback;
}
