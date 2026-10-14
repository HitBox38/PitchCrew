import { useMemo, useState } from 'react';
import { useCommandState } from 'cmdk';
import type { Card } from '@pitchcrew/core';
import { matchingJobCommands } from '../helpers.ts';
import { pageRange } from '../../lib/pagination.ts';

export function useJobCommands(cards: Card[]) {
  const search = useCommandState((state) => state.search);
  const matches = useMemo(() => matchingJobCommands(cards, search), [cards, search]);
  const [position, setPosition] = useState({ search, page: 0 });
  if (position.search !== search) setPosition({ search, page: 0 });
  const range = pageRange(matches.length, position.search === search ? position.page : 0, 25);
  return {
    ...range,
    total: matches.length,
    entries: matches.slice(range.start, range.end),
    setPage: (page: number) => setPosition({ search, page }),
  };
}
