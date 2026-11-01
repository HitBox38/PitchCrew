import type { Card, StaleSubmission } from '@pitchcrew/core';
import {
  applicationDate,
  cardOutcome,
  cardWeight,
  outcomes,
  staleBatchLimit,
  tagKey,
  type InsightLesson,
  type Outcome,
  tagSorts,
  type InsightsFilter,
  type TagSort,
} from '@pitchcrew/core/insights';
import type { InsightsSearch } from './types.ts';

export const validateInsightsSearch = (search: Record<string, unknown>): InsightsSearch => {
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
};

/** Converts URL filters into the shared insights filter, with local dates as instants. */
export const insightsFilter = (search: InsightsSearch): InsightsFilter => {
  return {
    tag: search.tag,
    from: search.from ? new Date(search.from).toISOString() : undefined,
    to: search.to ? new Date(search.to).toISOString() : undefined,
    sort: search.sort ?? 'count',
    tagLimit: 50,
    lessonLimit: 5,
  };
};

/** Distinct tags across the board, keeping the first spelling, alphabetically. */
export const boardTags = (cards: Card[]): string[] => {
  const tags = new Map<string, string>();
  for (const card of cards)
    for (const tag of card.tags) if (!tags.has(tagKey(tag))) tags.set(tagKey(tag), tag.trim());
  return [...tags.values()].sort((a, b) => a.localeCompare(b));
};

export const cardsWithTag = (cards: Card[], tag: string): Card[] => {
  return cards.filter((card) => card.tags.some((value) => tagKey(value) === tagKey(tag)));
};

export const percent = (rate: number | null): string => {
  return rate === null ? 'No outcomes yet' : `${Math.round(rate * 100)}%`;
};

/** The default selection contains only applications the preview allows changing. */
export const staleSelection = (cards: StaleSubmission[]): string[] => {
  return cards
    .filter((card) => !card.blocked)
    .slice(0, staleBatchLimit)
    .map((card) => card.id);
};

/** Positive share for the tag table: a dash when nothing is decided yet. */
export const share = (rate: number | null): string => {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
};

/**
 * Every lesson on the filtered applications, newest first, grouped by outcome. The shared
 * insights summary keeps only recent ones; Show all needs the complete list.
 */
export const filteredLessons = (
  cards: readonly Card[],
  search: InsightsSearch,
): Record<Outcome, InsightLesson[]> => {
  const filter = insightsFilter(search);
  const tag = filter.tag ? tagKey(filter.tag) : '';
  const from = filter.from ? Date.parse(filter.from) : Number.NEGATIVE_INFINITY;
  const to = filter.to ? Date.parse(filter.to) : Number.POSITIVE_INFINITY;
  const groups = Object.fromEntries(outcomes.map((outcome) => [outcome, []])) as unknown as Record<
    Outcome,
    InsightLesson[]
  >;
  for (const card of cards) {
    const date = Date.parse(applicationDate(card));
    if (card.sample || date < from || date > to) continue;
    if (tag && !card.tags.some((value) => tagKey(value) === tag)) continue;
    const outcome = cardOutcome(card.state);
    for (const lesson of card.lessons ?? [])
      groups[outcome].push({
        ...lesson,
        cardId: card.id,
        company: card.company,
        title: card.title,
        state: card.state,
        weight: cardWeight(card),
      });
  }
  for (const outcome of outcomes)
    groups[outcome].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
    );
  return groups;
};

const localDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
