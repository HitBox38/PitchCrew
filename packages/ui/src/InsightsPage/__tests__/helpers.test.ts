import type { Card } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import {
  boardTags,
  cardsWithTag,
  insightsFilter,
  percent,
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
  it('lists distinct tags case-insensitively and finds cards by tag', () => {
    expect(boardTags(cards)).toEqual(['Go', 'React', 'Remote']);
    expect(cardsWithTag(cards, 'REACT')).toHaveLength(2);
    expect(percent(null)).toBe('No outcomes yet');
    expect(percent(2 / 3)).toBe('67%');
  });
});
