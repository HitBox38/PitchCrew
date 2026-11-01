import type { Conversation, Role } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import { welcomeLine, welcomeStarters } from '../starters.ts';

const role = { name: 'Scout', description: 'Finds roles.' } as Role;
const group = { participants: ['scout', 'writer'] } as Conversation;

it('names one purpose for an empty conversation', () => {
  expect(welcomeLine({ roleId: 'scout', role, conversation: undefined, readOnly: false })).toBe(
    'Scout: Find the right opportunities',
  );
  expect(welcomeLine({ roleId: 'custom', role, conversation: undefined, readOnly: false })).toBe(
    'Scout: Finds roles.',
  );
  expect(welcomeLine({ roleId: 'scout', role, conversation: group, readOnly: false })).toContain(
    'Ask the group',
  );
  expect(welcomeLine({ roleId: 'scout', role, conversation: group, readOnly: true })).toContain(
    'Saved exchanges',
  );
});

it('offers job starters only with an attached job, and a role question last', () => {
  const plain = welcomeStarters({ roleId: 'scout', attached: undefined, conversation: undefined });
  expect(plain.map((item) => item.label)).toEqual([
    'Research a company',
    'What should I look for?',
    'Ask about this role',
  ]);
  const job = welcomeStarters({
    roleId: 'scout',
    attached: { id: 'job' } as never,
    conversation: undefined,
  });
  expect(job.map((item) => item.label)).toContain('Evaluate this job');
  expect(
    welcomeStarters({ roleId: 'scout', attached: undefined, conversation: group }),
  ).toHaveLength(1);
});
