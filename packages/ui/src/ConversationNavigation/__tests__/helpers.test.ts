import { describe, expect, it } from 'vitest';
import type { Conversation, Snapshot, ChatRequest } from '@pitchcrew/core';
import { chatGroups, conversationRows, groupAttention } from '../helpers.ts';
import type { ConversationNavigationRow } from '../types.ts';

const row = (id: string, conversation: Partial<Conversation> = {}): ConversationNavigationRow => ({
  conversation: {
    id,
    kind: 'direct',
    archived: false,
    participants: [],
    ...conversation,
  } as Conversation,
  preview: '',
  unread: false,
  working: false,
  waiting: false,
  waitingForUser: false,
});

describe('chat groups', () => {
  it('keeps ordinary and pinned chats in order and files agent chats, DMs, crew history and archived chats apart', () => {
    const rows = [
      row('pinned', { pinned: true }),
      row('scout', { participants: ['scout'] }),
      row('writer', { participants: ['writer'], pinned: true }),
      row('named', { participants: ['scout'] }),
      row('dm', { kind: 'agent_dm' }),
      row('history', { kind: 'history' }),
      row('group', { kind: 'group' }),
      row('old-dm', { kind: 'agent_dm', archived: true }),
      row('old', { archived: true }),
    ];
    const ids = (list: ConversationNavigationRow[]) => list.map((item) => item.conversation.id);
    const groups = chatGroups(rows);
    expect(ids(groups.main)).toEqual(['pinned', 'writer', 'named', 'group']);
    expect(ids(groups.agents)).toEqual(['scout']);
    expect(ids(groups.dms)).toEqual(['dm']);
    expect(ids(groups.history)).toEqual(['history']);
    expect(ids(groups.archived)).toEqual(['old-dm', 'old']);
  });
});

it('keeps unsent paused and failed messages visible as sidebar attention after they are read', () => {
  const conversations = ['paused', 'failed', 'done'].map((id) => ({
    ...row(id).conversation,
    title: id,
    updatedAt: '2026-11-06T12:00:00Z',
  }));
  const data = {
    roles: [],
    messages: [],
    runs: [],
    conversations,
    chatRequests: conversations.map(
      (conversation) =>
        ({
          threadId: conversation.id,
          deliveries: [{ status: conversation.id === 'done' ? 'completed' : conversation.id }],
        }) as ChatRequest,
    ),
  } as unknown as Snapshot;
  const rows = conversationRows(data, '', false, {});
  expect(rows.find((item) => item.conversation.id === 'paused')?.waitingForUser).toBe(true);
  expect(rows.find((item) => item.conversation.id === 'failed')?.failed).toBe(true);
  expect(rows.find((item) => item.conversation.id === 'done')?.waitingForUser).toBe(false);
  expect(groupAttention(rows)).toBe('failed');
});
