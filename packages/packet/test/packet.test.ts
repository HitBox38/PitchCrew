import { expect, it } from 'vitest';
import { packet } from '../../board/test/fixtures/packet.ts';
import { lintPacket } from '../src/index.ts';

it('checks source existence, exact evidence and packet inclusion', () => {
  const profile = [{ name: 'profile.md', content: '- Built React interfaces.' }];
  expect(lintPacket(packet, profile)).toEqual([]);
  expect(lintPacket(packet, [])).toContain('Source does not support: Built React interfaces.');
  const invented = {
    ...packet,
    claims: [
      { claim: 'Managed 100 people.', quote: 'Built React interfaces.', source: 'profile.md' },
    ],
  };
  expect(lintPacket(invented, profile).length).toBe(2);
  expect(lintPacket({ ...packet, resume: 'word '.repeat(651) }, profile)).toContain(
    'Resume exceeds 650 words.',
  );
});
