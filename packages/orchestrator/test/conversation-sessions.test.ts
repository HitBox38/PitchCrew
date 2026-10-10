import { Board } from '@pitchcrew/board';
import type {
  Conversation,
  ChatMessage,
  Role,
  ConversationSession,
  AgentMemory,
} from '@pitchcrew/core';
import { afterEach, expect, it } from 'vitest';
import { prepareSession, finishSession } from '../src/crew/sessions.ts';
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
function fixture() {
  const board = new Board(':memory:');
  boards.push(board);
  return { board, directory: '/fixture' };
}
function checkpoint(context: ReturnType<typeof fixture>) {
  const session = prepareSession(context, role, [], conversation, messages);
  session.onSession('11111111-1111-4111-8111-111111111111');
  finishSession(context, session.session, 'reply', false);
  return session;
}
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
