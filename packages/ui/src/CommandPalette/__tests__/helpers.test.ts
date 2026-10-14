import { describe, expect, it } from 'vitest';
import { defaultFilter } from 'cmdk';
import type { Card } from '@pitchcrew/core';
import { commandFilter, jobPagePrefix, jobCommandValue, matchingJobCommands } from '../helpers.ts';
import { pageRange } from '../../lib/pagination.ts';

const cards = Array.from({ length: 2500 }, (_, i) => ({
  id: `job-${i}`,
  title: `Engineer ${i}`,
  company: `Company ${i}`,
  location: 'Remote',
  tags: ['typescript'],
})) as Card[];

describe('bounded job command results', () => {
  it('keeps page commands keyboard selectable below fuzzy matches', () => {
    expect(commandFilter(`${jobPagePrefix}next`, 'unrelated')).toBeGreaterThan(0);
    expect(commandFilter(`${jobPagePrefix}next`, 'unrelated')).toBeLessThan(
      defaultFilter('unrelated job', 'unrelated'),
    );
    expect(commandFilter('Engineering', 'Eng')).toBe(defaultFilter('Engineering', 'Eng'));
  });
  it('finds jobs beyond the first rendered page across every existing search field', () => {
    const last = {
      ...cards[2499],
      company: 'Unique Acme',
      location: 'Atlantis',
      tags: ['quantum'],
    };
    const all = [...cards.slice(0, -1), last];
    for (const query of ['2499', 'UnAc', 'Atlantis', 'quantum', 'job-2499'])
      expect(matchingJobCommands(all, query).some(({ card }) => card.id === last.id)).toBe(true);
  });
  it('preserves cmdk fuzzy scores and stable ordering before slicing pages', () => {
    const query = 'Eng25';
    const expected = cards
      .map((card) => ({ card, score: defaultFilter(jobCommandValue(card), query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ card }) => card.id);
    const found = matchingJobCommands(cards, query);
    expect(found.map(({ card }) => card.id)).toEqual(expected);
    expect(matchingJobCommands(cards, 'zzzzzz-no-match')).toEqual([]);
    const reachable: string[] = [];
    for (let page = 0; page < Math.ceil(found.length / 25); page++) {
      const { start, end } = pageRange(found.length, page, 25);
      expect(end - start).toBeLessThanOrEqual(25);
      reachable.push(...found.slice(start, end).map(({ card }) => card.id));
    }
    expect(reachable).toEqual(expected);
  });
  it('makes every unfiltered job reachable exactly once and clamps after removals', () => {
    const result = matchingJobCommands(cards, '');
    expect(result.map(({ card }) => card.id)).toEqual(cards.map((card) => card.id));
    expect(pageRange(21, 50, 20)).toEqual({ page: 1, pages: 2, start: 20, end: 21 });
    expect(pageRange(0, 50, 40)).toEqual({ page: 0, pages: 1, start: 0, end: 0 });
  });
});
