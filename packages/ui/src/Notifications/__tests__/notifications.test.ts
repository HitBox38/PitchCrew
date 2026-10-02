import type { ChatMessage, Snapshot } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import { collectNotifications, NotificationTracker } from '../helpers.ts';

const message: ChatMessage = {
  id: 'fictional',
  threadId: 'scout',
  from: 'scout',
  to: 'user',
  content: 'Which fictional location?',
  cardId: null,
  runId: null,
  createdAt: '2026-01-01T00:00:00Z',
};
const snapshot = {
  roles: [{ id: 'scout', name: 'Scout' }],
  cards: [],
  messages: [message],
  streamingMessages: [{ ...message, id: 'preview' }],
  approvals: [],
  computerApprovals: [],
  proposals: [],
  skillProposals: [],
} as unknown as Snapshot;
it('notifies only saved agent messages and preserves the exact input request', () => {
  const items = collectNotifications({
    ...snapshot,
    messages: [
      message,
      { ...message, id: 'user', from: 'user' },
      { ...message, id: 'system', from: 'system' },
      { ...message, id: 'attention', notification: 'attention' },
    ],
  });
  expect(items).toHaveLength(2);
  expect(items.find((i) => i.id === 'message:attention')).toMatchObject({
    kind: 'attention',
    body: message.content,
    target: '/chat/scout',
  });
  expect(items.find((i) => i.id === 'message:fictional')?.kind).toBe('message');
});
it('uses attention for pending requests and removes decided requests', () => {
  const data = {
    ...snapshot,
    computerApprovals: [
      {
        id: 'browser',
        roleId: 'scout',
        status: 'pending',
        reason: 'Open the fictional job.',
        createdAt: message.createdAt,
      },
    ],
    proposals: [{ id: 'role', roleId: 'scout', status: 'applied', createdAt: message.createdAt }],
    skillProposals: [
      {
        id: 'skill',
        roleId: 'scout',
        status: 'pending',
        reason: 'Review this skill.',
        createdAt: message.createdAt,
      },
    ],
    approvals: [{ id: 'packet', status: 'pending', createdAt: message.createdAt }],
  } as unknown as Snapshot;
  const items = collectNotifications(data);
  expect(items.filter((i) => i.kind === 'attention')).toHaveLength(3);
  expect(items.filter((i) => i.target === '/inbox')).toHaveLength(2);
  expect(items.find((i) => i.id === 'proposal:skill')?.target).toBe('/chat/scout');
  expect(
    collectNotifications({ ...data, computerApprovals: [], skillProposals: [], approvals: [] }),
  ).toHaveLength(1);
});
it('baselines history silently and never repeats alerts on polls, reconnects or removed requests', () => {
  const tracker = new NotificationTracker();
  const initial = collectNotifications(snapshot);
  expect(tracker.update(initial)).toEqual([]);
  const newItem = { ...initial[0]!, id: 'new', kind: 'attention' as const };
  expect(tracker.update([newItem, ...initial])).toEqual([newItem]);
  expect(tracker.update([newItem, ...initial])).toEqual([]);
  expect(tracker.update(initial)).toEqual([]);
  expect(tracker.update([newItem, ...initial])).toEqual([]);
  expect(new NotificationTracker().update([newItem, ...initial])).toEqual([]);
});
