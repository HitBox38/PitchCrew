import { runHeaders } from '@pitchcrew/board';
import type { ChatMessage, ChatRequest } from '@pitchcrew/core';
import type { CrewContext } from './types.ts';
export const conversationMessages = (
  context: CrewContext,
  threadId: string,
  roleId: string,
  requestId?: string,
): ChatMessage[] => {
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
  // Thread messages through the thread index; their runs without configuration snapshots.
  const messages = (
    context.board.db
      .prepare(
        "SELECT json FROM entities WHERE kind='message' AND json_extract(json,'$.threadId')=? ORDER BY rowid",
      )
      .all(threadId) as { json: string }[]
  ).map((row) => JSON.parse(row.json) as ChatMessage);
  const runs = runHeaders(
    context.board,
    messages.flatMap((message) => (message.runId ? [message.runId] : [])),
  );
  return messages.filter(
    (message) =>
      !unreadMessages.has(message.id) &&
      (!message.runId || !unread.has(runs.get(message.runId)?.rootRunId ?? message.runId)),
  );
};
