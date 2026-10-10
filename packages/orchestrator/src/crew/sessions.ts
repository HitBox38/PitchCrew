import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { z } from 'zod';
import type {
  ConversationSession,
  Role,
  Skill,
  Conversation,
  ChatMessage,
  AgentMemory,
} from '@pitchcrew/core';
import type { CrewContext } from './types.ts';

export function prepareSession(
  context: Pick<CrewContext, 'board' | 'directory'>,
  role: Role,
  skills: Skill[],
  conversation: Conversation,
  messages: ChatMessage[],
) {
  const revision = createHash('sha256')
    .update(
      JSON.stringify({
        role,
        skills,
        participants: conversation.participants,
        leadId: conversation.leadId,
        cardId: conversation.cardId,
        summary: conversation.summary,
        memories: context.board
          .list<AgentMemory>('agent_memory')
          .filter((memory) => memory.roleId === role.id)
          .map((memory) => [memory.id, memory.updatedAt, memory.deleted]),
      }),
    )
    .digest('hex');
  const previous = context.board
    .list<ConversationSession>('conversation_session')
    .findLast((session) => session.threadId === conversation.id && session.roleId === role.id);
  const reusable =
    previous && previous.revision === revision && !previous.invalid && previous.nativeId;
  const session: ConversationSession = reusable
    ? { ...previous }
    : {
        id: randomUUID(),
        nativeId: null,
        directoryId: randomUUID(),
        threadId: conversation.id,
        roleId: role.id,
        runtime: role.runtime,
        revision,
        lastMessageId: null,
        invalid: false,
      };
  const directory = join(context.directory, 'roles', role.id, 'sessions', session.directoryId);
  const after = reusable
    ? messages.findIndex((message) => message.id === session.lastMessageId)
    : -1;
  return {
    session,
    directory,
    messages: after >= 0 ? messages.slice(after + 1) : messages,
    onSession: (id: string) => {
      session.nativeId = z.uuid().parse(id);
      context.board.record(
        'conversation_session',
        session,
        role.id,
        'Started native runtime session',
      );
    },
  };
}
export function finishSession(
  context: Pick<CrewContext, 'board'>,
  session: ConversationSession,
  lastMessageId: string | null,
  invalid: boolean,
) {
  context.board.record(
    'conversation_session',
    { ...session, lastMessageId, invalid },
    session.roleId,
    invalid ? 'Invalidated interrupted runtime session' : 'Saved runtime session checkpoint',
  );
}
