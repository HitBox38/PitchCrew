import { Board } from '@pitchcrew/board';
import { createHash } from 'node:crypto';
import type {
  Conversation,
  ChatMessage,
  Role,
  ConversationSession,
  AgentMemory,
  Skill,
} from '@pitchcrew/core';
import { afterEach, expect, it } from 'vitest';
import { prepareSession, finishSession } from '../src/crew/sessions.ts';
const fixture = () => {
  const board = new Board(':memory:');
  boards.push(board);
  return { board, directory: '/fixture' };
};
const checkpoint = (context: ReturnType<typeof fixture>) => {
  const session = prepareSession(context, role, [], conversation, messages);
  session.onSession('11111111-1111-4111-8111-111111111111');
  finishSession(context, session.session, 'reply', false);
  return session;
};

const boards: Board[] = [];
afterEach(() => {
  for (const board of boards.splice(0)) board.close();
});
const role: Role = {
  id: 'scout',
  name: 'Scout',
  description: 'Fixture',
  runtime: 'codex',
  model: '',
  enabled: true,
  instructions: 'Fixture',
};
const conversation: Conversation = {
  id: 'fixture',
  title: 'Fixture',
  kind: 'direct',
  participants: ['scout'],
  leadId: 'scout',
  cardId: null,
  createdBy: 'user',
  createdAt: '',
  updatedAt: '',
  archived: false,
  pinned: false,
  configurations: {},
};
const messages: ChatMessage[] = [
  {
    id: 'first',
    threadId: 'fixture',
    from: 'user',
    to: 'scout',
    content: 'First request.',
    cardId: null,
    runId: null,
    createdAt: '',
  },
  {
    id: 'reply',
    threadId: 'fixture',
    from: 'scout',
    to: 'user',
    content: 'Saved response.',
    cardId: null,
    runId: null,
    createdAt: '',
  },
  {
    id: 'next',
    threadId: 'fixture',
    from: 'user',
    to: 'scout',
    content: 'Next request.',
    cardId: null,
    runId: null,
    createdAt: '',
  },
];
it('resumes only the matching conversation participant and sends messages after its checkpoint', () => {
  const context = fixture();
  const first = checkpoint(context);
  context.board.rebuild();
  const next = prepareSession(context, role, [], conversation, messages);
  expect(next.session.nativeId).toBe(first.session.nativeId);
  expect(next.directory).toBe(first.directory);
  expect(next.messages).toEqual([messages[2]]);
  expect(
    prepareSession(context, role, [], { ...conversation, id: 'another' }, messages).session
      .nativeId,
  ).toBeNull();
  expect(
    prepareSession(context, { ...role, id: 'writer' }, [], conversation, messages).session.nativeId,
  ).toBeNull();
});
it('refreshes sessions when settings, membership, memory or continuation context changes', () => {
  const context = fixture();
  checkpoint(context);
  for (const changed of [
    { ...conversation, participants: ['scout', 'writer'] },
    { ...conversation, summary: { content: 'Summary', through: '', sources: ['first', 'reply'] } },
  ])
    expect(prepareSession(context, role, [], changed, messages).session.nativeId).toBeNull();
  expect(
    prepareSession(context, { ...role, model: 'other' }, [], conversation, messages).session
      .nativeId,
  ).toBeNull();
  const memory: AgentMemory = {
    id: 'note',
    roleId: 'scout',
    content: 'Useful note.',
    tags: [],
    source: { threadId: 'fixture' },
    updatedAt: '2026-10-08T00:00:00Z',
    deleted: false,
  };
  context.board.record('agent_memory', memory, 'scout', 'Fixture note');
  expect(prepareSession(context, role, [], conversation, messages).session.nativeId).toBeNull();
  checkpoint(context);
  context.board.record(
    'agent_memory',
    { ...memory, deleted: true, updatedAt: '2026-10-08T00:00:01Z' },
    'user',
    'Deleted note',
  );
  expect(prepareSession(context, role, [], conversation, messages).session.nativeId).toBeNull();
});
it('does not resume an interrupted native session', () => {
  const context = fixture();
  const first = checkpoint(context);
  finishSession(context, first.session, null, true);
  context.board.rebuild();
  expect(
    context.board.get<ConversationSession>('conversation_session', first.session.id).invalid,
  ).toBe(true);
  const next = prepareSession(context, role, [], conversation, messages);
  expect(next.session.nativeId).toBeNull();
  expect(next.messages).toEqual(messages);
  expect(next.directory).not.toBe(first.directory);
});

it.each([
  { label: 'pre-delivery', version: {} },
  { label: 'six-follow-up', version: { skillDeliveryVersion: 1 } },
])(
  'starts a new session for $label native transcripts even when their skills are unchanged',
  ({ version }) => {
    const context = fixture();
    const oldRevision = createHash('sha256')
      .update(
        JSON.stringify({
          ...version,
          role,
          skills: [],
          participants: conversation.participants,
          leadId: conversation.leadId,
          cardId: conversation.cardId,
          summary: conversation.summary,
          memories: [],
        }),
      )
      .digest('hex');
    const oldSession: ConversationSession = {
      id: 'old-session',
      nativeId: '11111111-1111-4111-8111-111111111111',
      directoryId: 'old-directory',
      threadId: conversation.id,
      roleId: role.id,
      runtime: role.runtime,
      revision: oldRevision,
      lastMessageId: 'reply',
      invalid: false,
    };
    context.board.record('conversation_session', oldSession, role.id, 'Saved old transcript');
    const next = prepareSession(context, role, [], conversation, messages);
    expect(next.session.nativeId).toBeNull();
    expect(next.session.revision).not.toBe(oldRevision);
    expect(next.directory).not.toContain('old-directory');
    expect(next.messages).toEqual(messages);
    next.onSession('22222222-2222-4222-8222-222222222222');
    finishSession(context, next.session, 'reply', false);
    const resumed = prepareSession(context, role, [], conversation, messages);
    expect(resumed.session.nativeId).toBe('22222222-2222-4222-8222-222222222222');
    expect(resumed.directory).toBe(next.directory);
    expect(resumed.messages).toEqual([messages[2]]);
  },
);

it('refreshes native context for skill delivery, body and assignment changes', () => {
  const context = fixture();
  const skill: Skill = {
    id: 'fixture-skill',
    name: 'Fixture skill',
    description: 'Use when relevant.',
    content: 'Exact initial instructions.',
    includeInEveryRun: false,
    scope: 'roles',
    roleIds: [role.id],
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
  };
  const first = prepareSession(context, role, [skill], conversation, messages);
  first.onSession('11111111-1111-4111-8111-111111111111');
  finishSession(context, first.session, 'reply', false);
  expect(prepareSession(context, role, [skill], conversation, messages).session.nativeId).toBe(
    first.session.nativeId,
  );
  for (const skills of [
    [{ ...skill, includeInEveryRun: true }],
    [{ ...skill, content: 'Updated instructions.' }],
    [],
  ]) {
    const changed = prepareSession(context, role, skills, conversation, messages);
    expect(changed.session.nativeId).toBeNull();
    expect(changed.directory).not.toBe(first.directory);
  }
});
