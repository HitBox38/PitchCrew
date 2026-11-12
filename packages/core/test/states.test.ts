import { expect, it } from 'vitest';
import {
  assertTransition,
  crewTransitions,
  reworkTransitions,
  states,
  transitions,
  type CardState,
} from '../src/states.ts';

// Deliberate copy of the workflow graph. Changing a transition means changing this table too.
const expected: Record<CardState, CardState[]> = {
  lead: ['shortlisted', 'withdrawn'],
  shortlisted: ['drafting', 'withdrawn'],
  drafting: ['in_review', 'changes_requested'],
  in_review: ['agreed', 'changes_requested'],
  changes_requested: ['drafting', 'withdrawn'],
  agreed: ['awaiting_approval', 'changes_requested'],
  awaiting_approval: ['agreed', 'changes_requested', 'submitted'],
  submitted: ['screening', 'interviewing', 'rejected', 'withdrawn', 'ghosted'],
  screening: ['interviewing', 'rejected', 'withdrawn', 'ghosted'],
  interviewing: ['offer', 'rejected', 'withdrawn', 'ghosted'],
  offer: ['withdrawn'],
  rejected: [],
  withdrawn: [],
  ghosted: ['screening', 'interviewing', 'withdrawn'],
};

it('defines a transition row for exactly the known states', () => {
  const known = [...states].sort();
  expect(Object.keys(transitions).sort()).toEqual(known);
  expect(Object.keys(expected).sort()).toEqual(known);
});

it('allows exactly the expected transitions for every ordered pair of states', () => {
  let pairs = 0;
  for (const from of states) {
    for (const to of states) {
      pairs += 1;
      if (expected[from].includes(to)) expect(() => assertTransition(from, to)).not.toThrow();
      else expect(() => assertTransition(from, to)).toThrow(`Cannot move ${from} to ${to}.`);
    }
  }
  expect(pairs).toBe(196);
});

it('keeps the approval-flow properties', () => {
  const into = states.filter((from) => transitions[from].includes('submitted'));
  expect(into).toEqual(['awaiting_approval']);
  expect(transitions.rejected).toEqual([]);
  expect(transitions.withdrawn).toEqual([]);
  for (const state of states) expect(transitions[state]).not.toContain(state);
});

it('pins the crew-only rework moves that skip a step of the normal graph', () => {
  expect(reworkTransitions).toEqual({
    changes_requested: ['in_review'],
    agreed: ['in_review'],
    awaiting_approval: ['in_review'],
    in_review: ['drafting'],
  });
  // Rework never reaches an outward step, and the normal graph stays a subset of crew moves.
  for (const state of states) {
    expect(crewTransitions(state)).toEqual(expect.arrayContaining(expected[state]));
    expect(reworkTransitions[state] ?? []).not.toContain('submitted');
  }
});
