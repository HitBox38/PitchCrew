import type { Card } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { defaultBoardSort, sortBoardCards, type BoardSort } from '../sorting.ts';
import { revealedJobPage } from '../pagination.ts';
import { pageRange } from '../../lib/pagination.ts';

const card = (id: string, fields: Partial<Card> = {}): Card => ({
  id,
  company: id,
  title: id,
  location: 'Remote',
  url: '',
  salary: '',
  description: '',
  tags: [],
  state: 'lead',
  fit: null,
  owner: null,
  packet: null,
  feedback: [],
  sample: false,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...fields,
});
const ids = (cards: Card[], sort: BoardSort) => sortBoardCards(cards, sort).map((job) => job.id);

describe('board column sorting', () => {
  it('defaults to highest fit first and leaves unscored jobs last in both directions', () => {
    const cards = [card('unscored'), card('low', { fit: 0 }), card('high', { fit: 95 })];
    expect(ids(cards, defaultBoardSort)).toEqual(['high', 'low', 'unscored']);
    expect(ids(cards, 'fit-asc')).toEqual(['low', 'high', 'unscored']);
    expect(cards.map((job) => job.id)).toEqual(['unscored', 'low', 'high']);
  });

  it.each<[BoardSort, string[]]>([
    ['created-desc', ['b', 'a']],
    ['created-asc', ['a', 'b']],
    ['updated-desc', ['a', 'b']],
    ['company-asc', ['b', 'a']],
    ['company-desc', ['a', 'b']],
    ['title-asc', ['a', 'b']],
    ['title-desc', ['b', 'a']],
  ])('orders jobs by %s', (sort, expected) => {
    const cards = [
      card('a', {
        company: 'Zebra',
        title: 'Analyst',
        updatedAt: '2026-10-03T00:00:00.000Z',
      }),
      card('b', {
        company: 'alpha',
        title: 'Writer',
        createdAt: '2026-10-02T00:00:00.000Z',
      }),
    ];
    expect(ids(cards, sort)).toEqual(expected);
  });

  it('breaks ties by newest added, then stable ID, regardless of incoming snapshot order', () => {
    const cards = [
      card('old', { fit: 80 }),
      card('b', { fit: 80, createdAt: '2026-10-02T00:00:00.000Z' }),
      card('a', { fit: 80, createdAt: '2026-10-02T00:00:00.000Z' }),
    ];
    expect(ids(cards, 'fit-desc')).toEqual(['a', 'b', 'old']);
    expect(ids(cards.toReversed(), 'fit-desc')).toEqual(['a', 'b', 'old']);
  });

  it('sorts the full column before paging and reveals moved jobs in their sorted position', () => {
    const cards = Array.from({ length: 45 }, (_, i) => card(`job-${i}`, { fit: i }));
    const sorted = sortBoardCards(cards, defaultBoardSort);
    expect(sorted.slice(0, 20).map((job) => job.fit)).toEqual(
      Array.from({ length: 20 }, (_, i) => 44 - i),
    );
    const page = revealedJobPage(sorted, 20, { id: 'job-0' });
    expect(page).toBe(2);
    const { start, end } = pageRange(sorted.length, page, 20);
    expect(sorted.slice(start, end).map((job) => job.id)).toContain('job-0');
  });
});
