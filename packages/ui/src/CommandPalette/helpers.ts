import { defaultFilter } from 'cmdk';
import type { Card } from '@pitchcrew/core';

export function jobCommandValue(card: Card) {
  return `${card.title} ${card.company} ${card.location} ${card.tags.join(' ')} ${card.id}`;
}

/** Match and rank the entire board with the same fuzzy scorer cmdk uses. */
export function matchingJobCommands(cards: Card[], search: string) {
  const entries = cards.map((card) => ({ card, value: jobCommandValue(card) }));
  if (!search) return entries;
  return entries
    .map((entry) => ({ ...entry, score: defaultFilter(entry.value, search) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
}

export const jobPagePrefix = 'pitchcrew:job-page:';

/** Keep paging in cmdk's registered keyboard selection, below every matching result. */
export function commandFilter(value: string, search: string, keywords?: string[]) {
  return value === `${jobPagePrefix}previous` || value === `${jobPagePrefix}next`
    ? Number.MIN_VALUE
    : defaultFilter(value, search, keywords);
}
