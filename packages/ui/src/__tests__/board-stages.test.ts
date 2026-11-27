import { expect, it } from 'vitest';
import type { Card } from '@pitchcrew/core';
import { stageCounts } from '../board-stages.ts';

it('counts jobs per open stage, open and closed, and leads not scored yet', () => {
  const cards = [
    { state: 'lead', fit: null },
    { state: 'lead' },
    { state: 'lead', fit: 0 },
    { state: 'shortlisted', fit: 72 },
    { state: 'drafting', fit: 72 },
    { state: 'awaiting_approval', fit: 80 },
    { state: 'interviewing', fit: 64 },
    { state: 'rejected', fit: 40 },
    { state: 'ghosted', fit: null },
  ] as Pick<Card, 'state' | 'fit'>[];
  expect(stageCounts(cards)).toEqual({
    open: 7,
    closed: 2,
    // A missing fit counts as unscored, as the job step reads it; a score of 0 is a score.
    notScored: 2,
    stages: [
      { id: 'lead', label: 'Leads', count: 3 },
      { id: 'shortlisted', label: 'Shortlisted', count: 1 },
      { id: 'progress', label: 'In progress', count: 2 },
      { id: 'applied', label: 'Applied', count: 1 },
    ],
  });
});
