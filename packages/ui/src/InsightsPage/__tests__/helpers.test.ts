import type { Card, StaleSubmission } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import {
  boardTags,
  cardsWithTag,
  insightsFilter,
  percent,
  staleSelection,
  validateInsightsSearch,
} from '../helpers.ts';

const cards = [
  { tags: ['React', 'Remote'] },
  { tags: ['react', 'Go'] },
  { tags: [] },
] as unknown as Card[];

describe('insights helpers', () => {
  it('keeps only valid URL filters', () => {
    expect(
      validateInsightsSearch({
        tag: '  React  ',
        from: '2026-01-01T09:00:00',
        to: 'tomorrow',
        sort: 'positive',
      }),
    ).toEqual({ tag: 'React', from: '2026-01-01T09:00:00', to: undefined, sort: 'positive' });
    expect(validateInsightsSearch({ sort: 'loudest', tag: 7 })).toEqual({
      tag: undefined,
      from: undefined,
      to: undefined,
      sort: undefined,
    });
  });
  it('converts local dates to instants and defaults the sort', () => {
    const filter = insightsFilter({ from: '2026-01-01T09:00:00' });
    expect(filter.from).toBe(new Date('2026-01-01T09:00:00').toISOString());
    expect(filter.sort).toBe('count');
  });
  it('selects an accepted batch when more than 200 stale applications are eligible', () => {
    const preview = Array.from({ length: 205 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      updatedAt: '2026-09-01T00:00:00.000Z',
      blocked: index === 0 ? 'Active workflow' : '',
    })) as StaleSubmission[];
    const selected = staleSelection(preview);
    expect(selected).not.toContain(preview[0].id);
    expect(selected).toHaveLength(200);
  });
  it('lists distinct tags case-insensitively and finds cards by tag', () => {
    expect(boardTags(cards)).toEqual(['Go', 'React', 'Remote']);
    expect(cardsWithTag(cards, 'REACT')).toHaveLength(2);
    expect(percent(null)).toBe('No outcomes yet');
    expect(percent(2 / 3)).toBe('67%');
  });
});
