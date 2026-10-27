import { useState } from 'react';
import type { Card } from '@pitchcrew/core';
import { pageRange } from '../../lib/pagination.ts';
import { revealedJobPage, type JobReveal } from '../pagination.ts';
export type { JobReveal } from '../pagination.ts';

export const useJobPage = (
  cards: Card[],
  size: number,
  query: string,
  reveal: JobReveal,
  sort: string,
) => {
  const [position, setPosition] = useState(() => ({
    page: revealedJobPage(cards, size, reveal),
    query,
    reveal,
    sort,
  }));
  let requested = position.page;
  if (query !== position.query || sort !== position.sort || reveal !== position.reveal) {
    requested =
      query !== position.query || sort !== position.sort
        ? 0
        : revealedJobPage(cards, size, reveal, requested);
    setPosition({ page: requested, query, reveal, sort });
  }
  const range = pageRange(cards.length, requested, size);
  return {
    ...range,
    total: cards.length,
    cards: cards.slice(range.start, range.end),
    setPage: (page: number) => setPosition({ page, query, reveal, sort }),
  };
};
