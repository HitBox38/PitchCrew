import { describe, expect, it } from 'vitest';
import type { Card, Conversation, Role } from '@pitchcrew/core';
import { matchingConversations, recentJobsFirst } from '../helpers.ts';

const conversation = (id: string, overrides: Partial<Conversation> = {}) =>
  ({
    id,
    title: `Thread ${id}`,
    kind: 'group',
    participants: ['scout'],
    cardId: null,
    archived: false,
    updatedAt: `2026-10-0${id}T00:00:00.000Z`,
    ...overrides,
  }) as Conversation;
const data = {
  cards: [{ id: 'card', company: 'Waypoint', title: 'Designer' }] as Card[],
  roles: [{ id: 'scout', name: 'Scout' }] as Role[],
  conversations: [
    conversation('1'),
    conversation('2', { cardId: 'card' }),
    conversation('3', { archived: true }),
    conversation('4', { deletedAt: '2026-10-05T00:00:00.000Z' }),
  ],
};

describe('palette results', () => {
  it('leads with recently opened jobs, newest first, when nothing is typed', () => {
    const entries = ['a', 'b', 'c', 'd'].map((id) => ({ card: { id } }));
    expect(recentJobsFirst(entries, ['c', 'a']).map((entry) => entry.card.id)).toEqual([
      'c',
      'a',
      'b',
      'd',
    ]);
  });
  it('lists recent open conversations, then searches every one but deleted', () => {
    expect(matchingConversations(data, '').map((entry) => entry.conversation.id)).toEqual([
      '2',
      '1',
    ]);
    expect(matchingConversations(data, '')[0]!.context).toBe('Waypoint · Designer');
    expect(matchingConversations(data, '')[1]!.context).toBe('Scout');
    const searched = matchingConversations(data, 'Thread').map((entry) => entry.conversation.id);
    expect(searched).toContain('3');
    expect(searched).not.toContain('4');
    expect(matchingConversations(data, 'waypoint')[0]!.conversation.id).toBe('2');
  });
});
