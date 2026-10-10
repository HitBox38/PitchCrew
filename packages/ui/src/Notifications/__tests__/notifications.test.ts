import type { ChatMessage, Snapshot } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import { notificationPresentation } from '../constants.ts';
import {
  collectNotifications,
  NotificationTracker,
  notificationToastOptions,
  notificationPreview,
} from '../helpers.ts';

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

it('gives each stacked toast a stable ID, full navigation data and bounded preview', () => {
  const item = collectNotifications(snapshot)[0]!;
  const messageToast = notificationToastOptions(item);
  expect(messageToast).toMatchObject({ id: item.id, timeout: 6000, priority: 'low', data: item });
  const attentionToast = notificationToastOptions({
    ...item,
    kind: 'attention',
    context: 'input',
    body: 'x'.repeat(500),
  });
  expect(attentionToast).toMatchObject({ timeout: 12000, type: 'warning' });
  expect(messageToast.description).toBeUndefined();
  expect(attentionToast.description).toHaveLength(96);
  expect(attentionToast.description?.endsWith('…')).toBe(true);
});

it('keeps attention previews brief while retaining the full request', () => {
  const body = 'Which fictional location?\n\nPlease choose a city. ' + 'Extra context. '.repeat(20);
  const item = {
    ...collectNotifications(snapshot)[0]!,
    kind: 'attention' as const,
    context: 'input' as const,
    body,
  };
  const options = notificationToastOptions(item);
  expect(options.description!.length).toBeLessThanOrEqual(96);
  expect(options.description).not.toContain('\n');
  expect(options.data.body).toBe(body);
  expect(notificationPreview('  Which city?\n  ')).toBe('Which city?');
});

it('distinguishes questions, approvals and proposals by their saved source', () => {
  const data = {
    ...snapshot,
    messages: [message, { ...message, id: 'question', notification: 'attention' }],
    approvals: [{ id: 'packet', status: 'pending', createdAt: message.createdAt }],
    computerApprovals: [
      {
        id: 'browser',
        roleId: 'scout',
        status: 'pending',
        reason: 'Open this listing.',
        createdAt: message.createdAt,
      },
    ],
    proposals: [
      {
        id: 'role',
        roleId: 'scout',
        status: 'pending',
        reason: 'Adjust my instructions.',
        createdAt: message.createdAt,
      },
    ],
    skillProposals: [
      {
        id: 'skill',
        roleId: 'scout',
        threadId: 'crew',
        status: 'pending',
        reason: 'Add this checklist.',
        createdAt: message.createdAt,
      },
    ],
  } as unknown as Snapshot;
  const items = collectNotifications(data);
  expect(
    items.map((item) => [item.context, notificationPresentation[item.context].action]).sort(),
  ).toEqual(
    [
      ['message', 'Open chat'],
      ['input', 'Answer question'],
      ['packet_approval', 'Review packet'],
      ['browser_approval', 'Review browser action'],
      ['role_proposal', 'Review role change'],
      ['skill_proposal', 'Review skill'],
    ].sort(),
  );
  const question = items.find((item) => item.context === 'input')!;
  expect(question).toMatchObject({ title: 'Scout needs your answer', target: '/chat/scout' });
  expect(notificationToastOptions(question).description).toBe(message.content);
  expect(items.find((item) => item.context === 'skill_proposal')?.target).toBe('/chat/crew');
  expect(
    items
      .filter((item) => item.context.endsWith('approval'))
      .every((item) => item.target === '/inbox'),
  ).toBe(true);
  expect(items.find((item) => item.id === 'message:fictional')?.context).toBe('message');
});
it('lists unanswered default instruction updates as attention items for Crew', () => {
  const update = {
    roleId: 'scout',
    state: 'unedited',
    revision: 'a'.repeat(16),
    instructions: 'Fictional new default.',
    changes: [
      { revision: 'b'.repeat(16), date: '2026-10-04', summary: 'Older fictional change.' },
      { revision: 'a'.repeat(16), date: '2026-10-05', summary: 'Fictional change summary.' },
    ],
    toolDifferences: [],
    dismissed: false,
  };
  const data = {
    ...snapshot,
    messages: [],
    roles: [
      { id: 'scout', name: 'Scout' },
      { id: 'writer', name: 'Writer', retiredAt: '2026-10-05T00:00:00Z' },
    ],
    instructionUpdates: [
      update,
      { ...update, roleId: 'writer' },
      { ...update, roleId: 'tracker', dismissed: true },
    ],
  } as unknown as Snapshot;
  const items = collectNotifications(data);
  expect(items).toEqual([
    {
      id: `instruction-update:scout:${'a'.repeat(16)}`,
      kind: 'attention',
      context: 'instruction_update',
      title: 'Scout has new default instructions',
      body: 'Fictional change summary.',
      target: '/crew',
      createdAt: '2026-10-05T00:00:00.000Z',
    },
  ]);
  expect(notificationPresentation.instruction_update.action).toBe('Review update');
  expect(collectNotifications({ ...data, instructionUpdates: undefined })).toEqual([]);
});
it('keeps internal exchanges quiet while retaining lead outcomes, explicit attention and conversation opt-in', () => {
  const group = {
    id: 'group',
    title: 'Group',
    kind: 'group' as const,
    participants: ['scout', 'writer'],
    leadId: 'scout',
    cardId: null,
    createdBy: 'user',
    createdAt: '',
    updatedAt: '',
    archived: false,
    pinned: false,
    configurations: {},
  };
  const dm = { ...group, id: 'dm', kind: 'agent_dm' as const };
  const data = {
    ...snapshot,
    conversations: [group, dm],
    messages: [
      { ...message, id: 'lead', threadId: 'group' },
      { ...message, id: 'member', from: 'writer', threadId: 'group' },
      { ...message, id: 'internal', threadId: 'dm', to: 'writer' },
      { ...message, id: 'attention-dm', threadId: 'dm', notification: 'attention' as const },
    ],
  };
  expect(
    collectNotifications(data)
      .map((item) => item.id)
      .sort(),
  ).toEqual(['message:attention-dm', 'message:lead']);
  expect(
    collectNotifications({ ...data, conversations: [{ ...group, notifyAll: true }, dm] })
      .map((item) => item.id)
      .sort(),
  ).toEqual(['message:attention-dm', 'message:lead', 'message:member']);
});

it('clears question attention after an answer or cancellation while preserving the transcript', () => {
  const q = {
    id: 'question',
    status: 'pending',
    question: message.content,
  } as import('@pitchcrew/core').UserInputRequest;
  const data = {
    ...snapshot,
    userInputs: [q],
    messages: [
      {
        ...message,
        notification: 'attention' as const,
        userInput: { id: q.id, kind: 'question' as const },
      },
    ],
  };
  expect(collectNotifications(data)[0]).toMatchObject({
    context: 'input',
    kind: 'attention',
    target: '/chat/scout',
  });
  expect(collectNotifications({ ...data, userInputs: [{ ...q, status: 'answered' }] })).toEqual([]);
  expect(collectNotifications({ ...data, userInputs: [{ ...q, status: 'cancelled' }] })).toEqual(
    [],
  );
  expect(data.messages).toHaveLength(1);
});
