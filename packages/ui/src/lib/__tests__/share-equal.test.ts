import { expect, it } from 'vitest';
import { shareEqual } from '../share-equal.ts';

it('keeps the identity of everything that did not change', () => {
  const prev = {
    runs: [
      { id: 'a', status: 'completed', activity: [{ id: 's1', label: 'Read' }] },
      { id: 'b', status: 'running', activity: [] },
    ],
    roles: [{ id: 'scout', name: 'Scout' }],
  };
  const next = JSON.parse(JSON.stringify(prev));
  next.runs[1].status = 'completed';
  next.runs.unshift({ id: 'c', status: 'running', activity: [] });
  const shared = shareEqual(prev, next);
  expect(shared).toEqual(next);
  expect(shared).not.toBe(prev);
  // A new run at the front does not cost the others their identity.
  expect(shared.runs[1]).toBe(prev.runs[0]);
  expect(shared.runs[2]).not.toBe(prev.runs[1]);
  expect(shared.runs[2].activity).toBe(prev.runs[1].activity);
  expect(shared.roles).toBe(prev.roles);
  expect(shareEqual(prev, JSON.parse(JSON.stringify(prev)))).toBe(prev);
});

it('drops removed keys and items', () => {
  const prev = { a: 1, b: [1, 2, 3] };
  const shared = shareEqual(prev, { a: 1, b: [1, 2] });
  expect(shared).toEqual({ a: 1, b: [1, 2] });
  expect(shareEqual({ a: 1, b: 2 }, { a: 1 })).toEqual({ a: 1 });
});
