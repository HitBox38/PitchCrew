import { randomUUID } from 'node:crypto';
import type { ChatRequest, ChatMessage, Run, AgentTask, UserInputRequest } from '@pitchcrew/core';
import { conversation } from './conversations.ts';
import { saveRequest, drainConversationQueue, sendConversation } from './conversation-queue.ts';
import type { CrewContext } from './types.ts';

export function continueConversation(context: CrewContext, id: string): ChatRequest {
  const item = conversation(context, id);
  if (['history', 'agent_dm'].includes(item.kind))
    throw new Error('Continue through a user conversation.');
  if (
    context.board
      .list<UserInputRequest>('user_input')
      .some((q) => q.status === 'pending' && q.threadId === id)
  )
    throw new Error('Answer or cancel the pending questions before continuing with a summary.');
  const roots = new Set(
    context.board
      .list<Run>('run')
      .filter((run) => run.threadId === id)
      .map((run) => run.rootRunId ?? run.id),
  );
  if (
    context.board
      .list<Run>('run')
      .some(
        (run) => ['running', 'waiting'].includes(run.status) && roots.has(run.rootRunId ?? run.id),
      ) ||
    context.board
      .list<AgentTask>('task')
      .some(
        (task) =>
          roots.has(task.rootRunId) && ['queued', 'running', 'waiting'].includes(task.status),
      ) ||
    context.board
      .list<import('@pitchcrew/core').ChatRequest>('chat_request')
      .some(
        (request) =>
          request.threadId === id &&
          request.summarize &&
          request.deliveries.some((delivery) => ['queued', 'running'].includes(delivery.status)),
      )
  )
    throw new Error('Wait for current work to finish before summarizing.');
  if (!item.leadId) throw new Error('Choose a lead before continuing.');
  const now = new Date().toISOString();
  const request: ChatRequest = {
    id: randomUUID(),
    messageId: randomUUID(),
    threadId: id,
    createdAt: now,
    order: Date.now(),
    attachments: [],
    summarize: true,
    content:
      'Create a concise continuation summary of this conversation: original request, decisions, completed work, remaining tasks, unresolved questions and relevant source message/file IDs. Preserve uncertainty and user constraints. Return the summary as your reply. Do not delegate, modify the board, save memories or perform application work during this summarization turn.',
    deliveries: [{ roleId: item.leadId, status: 'queued', runId: null, error: '' }],
  };
  saveRequest(context, request);
  void drainConversationQueue(context);
  return request;
}
export async function completeContinuation(
  context: CrewContext,
  run: Run,
  reply: string,
  sourceIds: string[],
): Promise<void> {
  if (!run.requestId) return;
  const request = context.board.get<ChatRequest>('chat_request', run.requestId);
  if (!request.summarize) return;
  if (!reply.trim()) throw new Error('The runtime did not return a continuation summary.');
  const item = conversation(context, request.threadId);
  const sources = context.board
    .list<ChatMessage>('message')
    .filter((message) => message.threadId === item.id && sourceIds.includes(message.id));
  context.board.record(
    'conversation',
    {
      ...item,
      summary: {
        content: reply,
        through: sources.at(-1)?.createdAt ?? request.createdAt,
        sources: sources.map((message) => message.id),
      },
    },
    'system',
    'Saved continuation summary',
  );
  await sendConversation(context, item.id, {
    content:
      'Continue the remaining work from the continuation summary. Preserve the original request and agreed constraints.',
  });
}
