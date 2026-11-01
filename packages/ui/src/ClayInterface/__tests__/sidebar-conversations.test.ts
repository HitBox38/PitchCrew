import { describe, expect, it } from 'vitest';
import type { Card, Conversation } from '@pitchcrew/core';
import type { ConversationNavigationRow } from '../../ConversationNavigation/types.ts';
import type { SidebarJob } from '../jobs.ts';
import { nestConversations, openJobIds, shortAge } from '../sidebar-conversations.ts';

const job = (id: string, signal: SidebarJob['signal'] = {}): SidebarJob => ({
  card: { id, company: id, state: 'drafting' } as Card,
  signal,
  status: 'Drafting',
});

const row = (
  id: string,
  conversation: Partial<Conversation> = {},
  state: Partial<ConversationNavigationRow> = {},
): ConversationNavigationRow => ({
  conversation: {
    id,
    title: id,
    kind: 'direct',
    participants: ['writer'],
    cardId: null,
    pinned: false,
    archived: false,
    updatedAt: '2026-10-30T09:00:00.000Z',
    ...conversation,
  } as Conversation,
  preview: '',
  unread: false,
  working: false,
  waiting: false,
  waitingForUser: false,
  ...state,
});

describe('clay sidebar conversations', () => {
  const jobs = [job('northstar'), job('waypoint')];

  it('nests live job conversations and keeps every other conversation in the list', () => {
    const rows = [
      row('draft', { cardId: 'northstar' }),
      row('fit', { cardId: 'northstar', updatedAt: '2026-10-31T09:00:00.000Z' }),
      row('asks', { cardId: 'northstar' }, { waitingForUser: true }),
      row('pinned', { cardId: 'northstar', pinned: true }),
      row('archived', { cardId: 'northstar', archived: true }),
      row('dm', { cardId: 'northstar', kind: 'agent_dm' }),
      row('lead', { cardId: 'orbit' }),
      row('standalone'),
    ];
    const { byCard, rest } = nestConversations(rows, jobs, '');
    expect(byCard.get('northstar')?.map((item) => item.conversation.id)).toEqual([
      'asks',
      'fit',
      'draft',
    ]);
    expect(rest.map((item) => item.conversation.id)).toEqual([
      'pinned',
      'archived',
      'dm',
      'lead',
      'standalone',
    ]);
  });

  it('keeps search matches together in the list', () => {
    const rows = [row('draft', { cardId: 'northstar' }), row('standalone')];
    const { byCard, rest } = nestConversations(rows, jobs, 'dra');
    expect(byCard.size).toBe(0);
    expect(rest).toHaveLength(2);
  });

  it('opens the focused job and jobs waiting on the user', () => {
    const asks = { decision: { kind: 'packet' } } as SidebarJob['signal'];
    const all = [job('northstar'), job('waypoint'), job('forma', asks), job('current')];
    const byCard = new Map([
      ['current', [row('q', { cardId: 'current' }, { waitingForUser: true })]],
    ]);
    expect([
      ...openJobIds(all, byCard, { threadCardId: 'northstar', selectedCardId: null }),
    ]).toEqual(['northstar', 'forma', 'current']);
  });

  it('formats compact ages', () => {
    const now = Date.parse('2026-10-31T12:00:00.000Z');
    expect(shortAge('2026-10-31T11:59:40.000Z', now)).toBe('now');
    expect(shortAge('2026-10-31T11:57:00.000Z', now)).toBe('3m');
    expect(shortAge('2026-10-31T07:00:00.000Z', now)).toBe('5h');
    expect(shortAge('2026-10-29T12:00:00.000Z', now)).toBe('2d');
  });
});
