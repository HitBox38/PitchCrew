import { expect, it } from 'vitest';
import { states } from '../src/states.ts';
import { queueSequenceProblems } from '../src/work-queue.ts';

it('can queue a deep review without a packet in exactly the five managed review stages', () => {
  const deepReview = { id: 'panel', boardAction: 'deep-review' } as const;
  const eligible = states.filter(
    (state) => !queueSequenceProblems({ state, packet: null }, [deepReview]).has(deepReview.id),
  );
  expect(new Set(eligible)).toEqual(
    new Set(['shortlisted', 'changes_requested', 'in_review', 'agreed', 'awaiting_approval']),
  );
  expect(
    queueSequenceProblems({ state: 'in_review', packet: null }, [
      { id: 'ordinary', boardAction: 'review' },
    ]),
  ).toEqual(new Map([['ordinary', 'Review needs a draft first.']]));
});
