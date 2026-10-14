import { useState } from 'react';
import type { Card } from '@pitchcrew/core';
import { pageRange } from '../../lib/pagination.ts';
import { revealedJobPage, type JobReveal } from '../pagination.ts';
export type { JobReveal } from '../pagination.ts';

export function useJobPage(cards: Card[], size: number, query: string, reveal: JobReveal) {
  const [position, setPosition] = useState(() => ({
    page: revealedJobPage(cards, size, reveal),
    query,
    reveal,
  }));
  let requested = position.page;
  if (query !== position.query || reveal !== position.reveal) {
    requested = query !== position.query ? 0 : revealedJobPage(cards, size, reveal, requested);
    setPosition({ page: requested, query, reveal });
  }
  const range = pageRange(cards.length, requested, size);
  return {
    ...range,
    total: cards.length,
    cards: cards.slice(range.start, range.end),
    setPage: (page: number) => setPosition({ page, query, reveal }),
  };
}
