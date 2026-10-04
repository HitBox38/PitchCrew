import type { Card, StaleSubmission } from '@pitchcrew/core';
import {
  staleBatchLimit,
  tagKey,
  tagSorts,
  type InsightsFilter,
  type TagSort,
} from '@pitchcrew/core/insights';
import type { InsightsSearch } from './types.ts';

const localDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

export function validateInsightsSearch(search: Record<string, unknown>): InsightsSearch {
  const text = (value: unknown, max: number) =>
    typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
  const date = (value: unknown) =>
    typeof value === 'string' && localDateTime.test(value) && Number.isFinite(Date.parse(value))
      ? value
      : undefined;
  return {
    tag: text(search.tag, 40),
    from: date(search.from),
    to: date(search.to),
    sort: tagSorts.includes(search.sort as TagSort) ? (search.sort as TagSort) : undefined,
  };
}

/** Converts URL filters into the shared insights filter, with local dates as instants. */
export function insightsFilter(search: InsightsSearch): InsightsFilter {
  return {
    tag: search.tag,
    from: search.from ? new Date(search.from).toISOString() : undefined,
    to: search.to ? new Date(search.to).toISOString() : undefined,
    sort: search.sort ?? 'count',
    tagLimit: 50,
    lessonLimit: 5,
  };
}

/** Distinct tags across the board, keeping the first spelling, alphabetically. */
export function boardTags(cards: Card[]): string[] {
  const tags = new Map<string, string>();
  for (const card of cards)
    for (const tag of card.tags) if (!tags.has(tagKey(tag))) tags.set(tagKey(tag), tag.trim());
  return [...tags.values()].sort((a, b) => a.localeCompare(b));
}

export function cardsWithTag(cards: Card[], tag: string): Card[] {
  return cards.filter((card) => card.tags.some((value) => tagKey(value) === tagKey(tag)));
}

export function percent(rate: number | null): string {
  return rate === null ? 'No outcomes yet' : `${Math.round(rate * 100)}%`;
}

/** The default selection contains only applications the preview allows changing. */
export function staleSelection(cards: StaleSubmission[]): string[] {
  return cards
    .filter((card) => !card.blocked)
    .slice(0, staleBatchLimit)
    .map((card) => card.id);
}
