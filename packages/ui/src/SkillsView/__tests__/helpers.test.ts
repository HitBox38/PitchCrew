import { expect, it } from 'vitest';
import { groupedStarterErrors } from '../helpers.ts';

it('shows each starter skill failure reason once with every affected skill', () => {
  const limit = 'GitHub’s public request limit was reached. Try importing again later.';
  expect(
    groupedStarterErrors([
      { name: 'cover-letter', error: limit },
      { name: 'view-pdf', error: 'Not found.' },
      { name: 'humanizer', error: limit },
    ]),
  ).toEqual([
    { error: limit, names: ['cover-letter', 'humanizer'] },
    { error: 'Not found.', names: ['view-pdf'] },
  ]);
});
