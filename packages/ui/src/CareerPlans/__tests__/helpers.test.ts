import { expect, it } from 'vitest';
import { planScope } from '../helpers.ts';

it('names every part of a plan scope in one line', () => {
  expect(planScope({ title: 'Platform engineer', tag: 'remote', cardIds: ['a', 'b'] })).toBe(
    'Role: Platform engineer · Tag: remote · 2 chosen jobs',
  );
  expect(planScope({ title: '', tag: '', cardIds: ['a'] })).toBe('1 chosen job');
});
