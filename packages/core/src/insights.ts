// Zod-free learning signals and insights, safe to import from the UI bundle.
import type { Card, CardLesson } from './cards.ts';
import type { CardState } from './states.ts';

export const weightRange = { min: -2, max: 2 } as const;
export const weights = [-2, -1, 0, 1, 2] as const;
export const lessonLimits = { count: 20, length: 1000 } as const;
export const staleDefaults = { days: 21, minimum: 1, maximum: 365 } as const;
export const staleBatchLimit = 200;
export const insightLimits = { tags: 50, lessons: 10, companies: 5 } as const;
export const tagSorts = ['count', 'positive', 'weight', 'tag'] as const;
export type TagSort = (typeof tagSorts)[number];
export const outcomes = ['positive', 'negative', 'neutral', 'pending'] as const;
export type Outcome = (typeof outcomes)[number];

export interface InsightsFilter {
  /** Case-insensitive tag; only applications carrying it are counted. */
  tag?: string;
  /** Inclusive ISO bounds on the application date. */
  from?: string;
  to?: string;
  sort?: TagSort;
  /** Maximum scoreboard rows (default and maximum 50). */
  tagLimit?: number;
  /** Maximum recent lessons per outcome (default 5, maximum 10). */
  lessonLimit?: number;
  /** Example cards are fictional and excluded unless requested. */
  includeSamples?: boolean;
}
export interface TagScore {
  tag: string;
  count: number;
  decided: number;
  positive: number;
  /** Positive share of decided applications, or null when none are decided. */
  positiveRate: number | null;
  averageWeight: number;
  companies: string[];
}
export interface InsightLesson extends CardLesson {
  cardId: string;
  company: string;
  title: string;
  state: CardState;
  weight: number;
}
export interface ApplicationInsights {
  filter: { tag: string | null; from: string | null; to: string | null; sort: TagSort };
  total: number;
  outcomes: Record<Outcome, number>;
  weights: { weight: number; count: number }[];
  tags: TagScore[];
  tagCount: number;
  lessons: Record<Outcome, InsightLesson[]>;
}

export function cardOutcome(state: CardState): Outcome {
  if (state === 'interviewing' || state === 'offer') return 'positive';
  if (state === 'rejected' || state === 'ghosted') return 'negative';
  if (state === 'withdrawn') return 'neutral';
  return 'pending';
}
export function cardWeight(card: Pick<Card, 'weight'>): number {
  const weight = card.weight ?? 0;
  return Number.isInteger(weight) && weight >= weightRange.min && weight <= weightRange.max
    ? weight
    : 0;
}
export function tagKey(tag: string): string {
  return tag.normalize('NFKC').trim().toLowerCase();
}
/** Applications registered as applied elsewhere use their submission time. */
export function applicationDate(card: Pick<Card, 'createdAt' | 'tracking'>): string {
  return card.tracking?.submittedAt ?? card.createdAt;
}
function bounded(value: number | undefined, fallback: number, maximum: number) {
  return Math.min(maximum, Math.max(1, Math.floor(value ?? fallback)));
}
function compareTags(sort: TagSort) {
  return (a: TagScore, b: TagScore) => {
    const order =
      sort === 'positive'
        ? (b.positiveRate ?? -1) - (a.positiveRate ?? -1) || b.decided - a.decided
        : sort === 'weight'
          ? b.averageWeight - a.averageWeight
          : sort === 'count'
            ? b.count - a.count
            : 0;
    return order || a.tag.localeCompare(b.tag);
  };
}

export function applicationInsights(
  cards: readonly Card[],
  filter: InsightsFilter = {},
): ApplicationInsights {
  const sort = filter.sort ?? 'count';
  const tag = filter.tag?.trim() ? tagKey(filter.tag) : '';
  const from = filter.from ? Date.parse(filter.from) : Number.NEGATIVE_INFINITY;
  const to = filter.to ? Date.parse(filter.to) : Number.POSITIVE_INFINITY;
  const selected = cards.filter((card) => {
    const date = Date.parse(applicationDate(card));
    return (
      (filter.includeSamples || !card.sample) &&
      (!tag || card.tags.some((value) => tagKey(value) === tag)) &&
      date >= from &&
      date <= to
    );
  });
  const counts = { positive: 0, negative: 0, neutral: 0, pending: 0 };
  const weightCounts = new Map<number, number>(weights.map((weight) => [weight, 0]));
  const scores = new Map<string, TagScore & { weightTotal: number }>();
  const lessons: Record<Outcome, InsightLesson[]> = {
    positive: [],
    negative: [],
    neutral: [],
    pending: [],
  };
  for (const card of selected) {
    const outcome = cardOutcome(card.state);
    const weight = cardWeight(card);
    counts[outcome] += 1;
    weightCounts.set(weight, (weightCounts.get(weight) ?? 0) + 1);
    const seen = new Set<string>();
    for (const value of card.tags) {
      const key = tagKey(value);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const score = scores.get(key) ?? {
        tag: value.trim(),
        count: 0,
        decided: 0,
        positive: 0,
        positiveRate: null,
        averageWeight: 0,
        companies: [],
        weightTotal: 0,
      };
      score.count += 1;
      score.weightTotal += weight;
      if (outcome !== 'pending') score.decided += 1;
      if (outcome === 'positive') score.positive += 1;
      if (
        score.companies.length < insightLimits.companies &&
        !score.companies.some((company) => tagKey(company) === tagKey(card.company))
      )
        score.companies.push(card.company);
      scores.set(key, score);
    }
    for (const lesson of card.lessons ?? [])
      lessons[outcome].push({
        ...lesson,
        cardId: card.id,
        company: card.company,
        title: card.title,
        state: card.state,
        weight,
      });
  }
  const lessonLimit = bounded(filter.lessonLimit, 5, insightLimits.lessons);
  const tags = [...scores.values()].map(({ weightTotal, ...score }) => ({
    ...score,
    positiveRate: score.decided ? round(score.positive / score.decided) : null,
    averageWeight: round(weightTotal / score.count),
  }));
  return {
    filter: {
      tag: filter.tag?.trim() || null,
      from: filter.from ?? null,
      to: filter.to ?? null,
      sort,
    },
    total: selected.length,
    outcomes: counts,
    weights: weights.map((weight) => ({ weight, count: weightCounts.get(weight) ?? 0 })),
    tags: tags
      .sort(compareTags(sort))
      .slice(0, bounded(filter.tagLimit, insightLimits.tags, insightLimits.tags)),
    tagCount: tags.length,
    lessons: Object.fromEntries(
      outcomes.map((outcome) => [
        outcome,
        lessons[outcome]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
          .slice(0, lessonLimit),
      ]),
    ) as Record<Outcome, InsightLesson[]>,
  };
}
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
