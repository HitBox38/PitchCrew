import type { ChatMessage, ChatRequest, Run } from '@pitchcrew/core';
import type { CrewContext } from './types.ts';
export function conversationMessages(
  context: CrewContext,
  threadId: string,
  roleId: string,
  requestId?: string,
): ChatMessage[] {
  const requests = context.board.list<ChatRequest>('chat_request');
  const unread = new Set(
    requests
      .filter(
        (request) =>
          request.id !== requestId &&
          request.deliveries.some(
            (delivery) =>
              delivery.roleId === roleId && ['queued', 'paused'].includes(delivery.status),
          ),
      )
      .map((request) => request.id),
  );
  const unreadMessages = new Set(
    requests.filter((request) => unread.has(request.id)).map((request) => request.messageId),
  );
  const runs = new Map(context.board.list<Run>('run').map((run) => [run.id, run]));
  return context.board
    .list<ChatMessage>('message')
    .filter(
      (message) =>
        message.threadId === threadId &&
        !unreadMessages.has(message.id) &&
        (!message.runId || !unread.has(runs.get(message.runId)?.rootRunId ?? message.runId)),
    );
}
