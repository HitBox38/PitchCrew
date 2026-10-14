import type { Card } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { revealedJobPage } from '../pagination.ts';
import { pageRange } from '../../lib/pagination.ts';

const cards = Array.from({ length: 2000 }, (_, i) => ({ id: `job-${i}` })) as Card[];

describe('board job pages', () => {
  it('bounds closed pages while preserving every card in the existing order', () => {
    const reachable = [];
    for (let requested = 0; requested < 50; requested++) {
      const { start, end } = pageRange(cards.length, requested, 40);
      const page = cards.slice(start, end);
      expect(page).toHaveLength(40);
      reachable.push(...page);
    }
    expect(reachable).toEqual(cards);
  });
  it('reveals a moved card on its destination page, including a newly mounted view', () => {
    for (const size of [20, 40]) {
      const page = revealedJobPage(cards, size, { id: 'job-1999' });
      const { start, end } = pageRange(cards.length, page, size);
      expect(cards.slice(start, end).some((card) => card.id === 'job-1999')).toBe(true);
    }
    expect(revealedJobPage(cards, 20, { id: 'missing' }, 4)).toBe(4);
    expect(revealedJobPage(cards, 20, null)).toBe(0);
  });
  it('clamps removals without losing the requested source page for a rollback', () => {
    expect(pageRange(41, 2, 20).start).toBe(40);
    expect(pageRange(40, 2, 20).start).toBe(20);
    expect(pageRange(41, 2, 20).start).toBe(40);
  });
});
