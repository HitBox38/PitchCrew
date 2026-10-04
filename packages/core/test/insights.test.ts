import { describe, expect, it } from 'vitest';
import {
  applicationInsights,
  cardOutcome,
  insightsQuery,
  type Card,
  type CardState,
} from '../src/index.ts';

let sequence = 0;
function card(company: string, state: CardState, tags: string[], extra: Partial<Card> = {}): Card {
  sequence += 1;
  return {
    id: `card-${sequence}`,
    company,
    title: 'Fictional Engineer',
    location: 'Remote',
    url: '',
    salary: '',
    description: '',
    tags,
    state,
    fit: null,
    owner: null,
    packet: null,
    feedback: [],
    createdAt: `2026-0${(sequence % 9) + 1}-01T00:00:00.000Z`,
    updatedAt: '2026-09-01T00:00:00.000Z',
    sample: false,
    ...extra,
  };
}
const lesson = (id: string, text: string, createdAt: string) => ({ id, text, createdAt });

describe('outcomes', () => {
  it('derives positive, negative, neutral and pending outcomes from card state', () => {
    expect(cardOutcome('interviewing')).toBe('positive');
    expect(cardOutcome('offer')).toBe('positive');
    expect(cardOutcome('rejected')).toBe('negative');
    expect(cardOutcome('ghosted')).toBe('negative');
    expect(cardOutcome('withdrawn')).toBe('neutral');
    for (const state of ['lead', 'submitted', 'screening', 'awaiting_approval'] as const)
      expect(cardOutcome(state)).toBe('pending');
  });
});

describe('application insights', () => {
  const cards = [
    card('Juniper Analytics', 'offer', ['React', 'Remote'], {
      weight: 2,
      lessons: [lesson('l1', 'Lead with the design system migration.', '2026-05-02T00:00:00Z')],
    }),
    card('Harbor Freight Labs', 'interviewing', ['react'], { weight: 1 }),
    card('Quill Systems', 'rejected', ['React', 'Fintech'], {
      weight: -2,
      lessons: [lesson('l2', 'Too little backend depth.', '2026-06-02T00:00:00Z')],
    }),
    card('Oakline Studio', 'ghosted', ['Fintech']),
    card('Pebble Works', 'withdrawn', ['Fintech'], { weight: -1 }),
    card('Lantern Health', 'submitted', ['React'], {
      lessons: [lesson('l3', 'Waiting on a referral.', '2026-07-02T00:00:00Z')],
    }),
    card('Example Sample Co', 'offer', ['React'], { sample: true, weight: 2 }),
  ];

  it('counts outcomes, weights and a case-insensitive tag scoreboard, excluding samples', () => {
    const insights = applicationInsights(cards);
    expect(insights.total).toBe(6);
    expect(insights.outcomes).toEqual({ positive: 2, negative: 2, neutral: 1, pending: 1 });
    expect(insights.weights).toEqual([
      { weight: -2, count: 1 },
      { weight: -1, count: 1 },
      { weight: 0, count: 2 },
      { weight: 1, count: 1 },
      { weight: 2, count: 1 },
    ]);
    const react = insights.tags.find((tag) => tag.tag === 'React')!;
    // React: offer, interviewing, rejected, submitted (pending). Two of three decided are positive.
    expect(react).toMatchObject({ count: 4, decided: 3, positive: 2, averageWeight: 0.25 });
    expect(react.positiveRate).toBeCloseTo(0.667, 3);
    expect(react.companies).toEqual([
      'Juniper Analytics',
      'Harbor Freight Labs',
      'Quill Systems',
      'Lantern Health',
    ]);
    const fintech = insights.tags.find((tag) => tag.tag === 'Fintech')!;
    expect(fintech).toMatchObject({ count: 3, decided: 3, positive: 0, positiveRate: 0 });
    expect(fintech.averageWeight).toBe(-1);
    expect(insights.tags.map((tag) => tag.tag)).toEqual(['React', 'Fintech', 'Remote']);
    expect(insights.lessons.positive.map((item) => item.id)).toEqual(['l1']);
    expect(insights.lessons.negative[0]).toMatchObject({
      id: 'l2',
      company: 'Quill Systems',
      weight: -2,
      state: 'rejected',
    });
    expect(insights.lessons.pending.map((item) => item.id)).toEqual(['l3']);
    expect(applicationInsights(cards, { includeSamples: true }).total).toBe(7);
  });

  it('sorts by positive share, weight and name, and reports undecided tags as null', () => {
    const extra = [...cards, card('Mosaic Labs', 'lead', ['Go'])];
    const positive = applicationInsights(extra, { sort: 'positive' });
    expect(positive.tags.map((tag) => tag.tag)).toEqual(['Remote', 'React', 'Fintech', 'Go']);
    expect(positive.tags.at(-1)!.positiveRate).toBeNull();
    expect(applicationInsights(extra, { sort: 'weight' }).tags[0].tag).toBe('Remote');
    expect(applicationInsights(extra, { sort: 'tag' }).tags.map((tag) => tag.tag)).toEqual([
      'Fintech',
      'Go',
      'React',
      'Remote',
    ]);
  });

  it('filters by tag and inclusive application date, using external submission times', () => {
    const external = card('Northwind Labs', 'rejected', ['Go'], {
      createdAt: '2026-09-30T00:00:00.000Z',
      tracking: {
        origin: 'external',
        submittedAt: '2025-12-15T00:00:00.000Z',
        gmailThreads: [],
      },
    });
    const all = [...cards, external];
    expect(applicationInsights(all, { tag: 'FINTECH' }).total).toBe(3);
    const window = applicationInsights(all, {
      from: '2025-12-01T00:00:00Z',
      to: '2025-12-31T23:59:59Z',
    });
    expect(window.total).toBe(1);
    expect(window.tags[0]).toMatchObject({ tag: 'Go', companies: ['Northwind Labs'] });
  });

  it('bounds tags, companies and lessons', () => {
    const many = Array.from({ length: 70 }, (_, index) =>
      card(`Fictional Company ${index}`, 'rejected', [`tag-${index}`, 'shared'], {
        lessons: Array.from({ length: 3 }, (_, item) =>
          lesson(
            `${index}-${item}`,
            'A lesson.',
            `2026-01-01T00:${String(item).padStart(2, '0')}:00Z`,
          ),
        ),
      }),
    );
    const insights = applicationInsights(many, { tagLimit: 500, lessonLimit: 500 });
    expect(insights.tags).toHaveLength(50);
    expect(insights.tagCount).toBe(71);
    expect(insights.tags[0]).toMatchObject({ tag: 'shared', count: 70 });
    expect(insights.tags[0].companies).toHaveLength(5);
    expect(insights.lessons.negative).toHaveLength(10);
    expect(applicationInsights(many).lessons.negative).toHaveLength(5);
  });

  it('validates query bounds and date order', () => {
    expect(insightsQuery.parse({})).toMatchObject({ sort: 'count', tagLimit: 20, lessonLimit: 5 });
    expect(() => insightsQuery.parse({ tagLimit: 51 })).toThrow();
    expect(() => insightsQuery.parse({ unknown: true })).toThrow();
    expect(() =>
      insightsQuery.parse({ from: '2026-02-01T00:00:00Z', to: '2026-01-01T00:00:00Z' }),
    ).toThrow('start date');
  });
});
