import { expect, it } from 'vitest';
import type { BoardEvent } from '@pitchcrew/core';
import { activityDetail, activitySentence } from '../labels.ts';

const names: Record<string, string> = { writer: 'Writer', reviewer: 'Reviewer' };
const say = (kind: BoardEvent['kind'], message: string) =>
  activitySentence({ kind, message }, (id) => names[id]);

it('rewrites stored event wording into product language', () => {
  expect(say('message', 'reviewer messaged crew')).toBe('Reviewer messaged the crew');
  expect(say('message', 'You messaged writer')).toBe('You messaged Writer');
  expect(say('card', 'Moved to agreed')).toBe('Moved to Reviewed');
  expect(say('card', 'Moved to in review')).toBe('Moved to In review');
  expect(say('card', 'User changed status to awaiting approval')).toBe(
    'Moved to Awaiting approval',
  );
  expect(say('card', 'User changed status to agreed')).toBe('Moved to Reviewed');
  expect(say('card', 'Released application')).toBe('Released the job for the next step');
  expect(
    say(
      'card',
      'Imported a past application (import key 0123456789abcdef01234567); registered a known external submission, no outward action',
    ),
  ).toBe('Imported a past application');
  expect(say('card', 'Imported past status in review effective 2030-01-05T12:00:00.000Z')).toBe(
    'Imported past status: In review',
  );
  expect(say('role', 'Initialized Writer')).toBe('Added Writer to the crew');
  expect(say('run', 'Started Writer on demo')).toBe('Started Writer with Demo');
  expect(say('conversation', 'Created Fictional: Application work')).toBe(
    'Started the conversation “Fictional: Application work”',
  );
});

it('passes unknown wording through unchanged', () => {
  expect(say('card', 'Moved to somewhere new')).toBe('Moved to somewhere new');
  expect(say('card', 'User changed status to somewhere new')).toBe(
    'User changed status to somewhere new',
  );
  expect(say('run', 'Writer completed its work')).toBe('Writer completed its work');
});

it('names who acted and where for conversation records', () => {
  const titles: Record<string, string> = { t1: 'Waypoint packet review' };
  const record = (kind: BoardEvent['kind'], message: string, data: Record<string, unknown>) =>
    activitySentence(
      { kind, message, data: data as never },
      (id) => names[id],
      (id) => titles[id],
    );
  expect(
    record('message', 'Example conversation message', { from: 'writer', threadId: 't1' }),
  ).toBe('Writer messaged “Waypoint packet review”');
  expect(record('message', 'Example conversation message', { from: 'user', threadId: 't1' })).toBe(
    'You messaged “Waypoint packet review”',
  );
  expect(
    record('message', 'Example conversation message', { from: 'system', threadId: 't1' }),
  ).toBe('New message in “Waypoint packet review”');
  expect(record('message', 'Example conversation message', { from: 'writer' })).toBe(
    'Writer sent a message',
  );
  expect(record('run', 'Example chat turn', { roleId: 'reviewer', threadId: 't1' })).toBe(
    'Reviewer replied in “Waypoint packet review”',
  );
  expect(record('task', 'Example crew follow-up', { roleId: 'reviewer' })).toBe(
    'Queued a follow-up for Reviewer',
  );
});

it('keeps import keys and effective dates behind details', () => {
  expect(
    activityDetail({
      kind: 'card',
      message:
        'Imported a past application (import key 0123456789abcdef01234567); registered a known external submission, no outward action',
    }),
  ).toBe(
    'Import key 0123456789abcdef01234567. Registered a known external submission, no outward action.',
  );
  expect(
    activityDetail({
      kind: 'card',
      message: 'Imported past status submitted effective 2026-10-17T00:00:00.000Z',
    }),
  ).toMatch(/^Effective .*17.*2026$/);
  expect(activityDetail({ kind: 'card', message: 'Moved to agreed' })).toBeUndefined();
});
