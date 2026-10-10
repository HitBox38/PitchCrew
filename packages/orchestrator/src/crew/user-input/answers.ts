import { originalQuestionTask, questionContinuationAllowed } from './context.ts';
import { randomUUID } from 'node:crypto';
import {
  userAnswerInput,
  type ChatRequest,
  type Run,
  type UserInputRequest,
} from '@pitchcrew/core';
import { canReadConversation } from '../conversations.ts';
import { requireRole } from '../roles.ts';
import { drainConversationQueue } from '../conversation-queue.ts';
import { cancelUserQuestions } from './lifecycle.ts';
import type { CrewContext } from '../types.ts';

export function answerUserQuestion(context: CrewContext, id: string, data: unknown): ChatRequest {
  const answer = userAnswerInput.parse(data);
  const question = context.board.get<UserInputRequest>('user_input', id);
  if (question.status !== 'pending')
    throw new Error('This question is no longer awaiting an answer.');
  const role = requireRole(context, question.roleId);
  if (
    !canReadConversation(context, role.id, question.sourceThreadId) ||
    !canReadConversation(context, role.id, question.threadId)
  )
    throw new Error('The asking agent no longer participates in this conversation.');
  const original = context.board.get<Run>('run', question.runId);
  if (!questionContinuationAllowed(context, original))
    throw new Error(
      'The originating agent’s capabilities changed. Cancel this question and start a new request.',
    );
  const options = new Map(question.options.map((option) => [option.id, option.label]));
  if (
    new Set(answer.selected).size !== answer.selected.length ||
    answer.selected.some((id) => !options.has(id)) ||
    (!question.multiSelect && answer.selected.length > 1)
  )
    throw new Error('Choose valid options for this question.');
  const content = [...answer.selected.map((id) => options.get(id)!), answer.text]
    .filter(Boolean)
    .join('\n');
  const request: ChatRequest = {
    id: randomUUID(),
    threadId: question.sourceThreadId,
    messageId: randomUUID(),
    content: `Continue your interrupted task after the user answered your question.\nOriginal request: ${originalQuestionTask(context, original)}\nWork so far and next steps: ${question.continuationNotes || 'Use the saved conversation and current board state.'}\nQuestion: ${question.question}\nAnswer: ${content}`,
    attachments: [],
    createdAt: new Date().toISOString(),
    order:
      Math.min(Date.now(), ...context.board.list<ChatRequest>('chat_request').map((r) => r.order)) -
      1,
    deliveries: [{ roleId: role.id, status: 'queued', runId: null, error: '' }],
    userInputId: id,
    rootRunId: original.rootRunId ?? original.id,
    mode: original.mode ?? 'chat',
  };
  context.board.db.transaction(() => {
    const message = context.addMessage(
      question.threadId,
      'user',
      role.id,
      content,
      question.cardId,
      null,
      request.messageId,
    );
    context.board.record(
      'message',
      { ...message, userInput: { id, kind: 'answer' } },
      'user',
      'Answered user question',
    );
    if (question.sourceThreadId !== question.threadId)
      context.addMessage(
        question.sourceThreadId,
        'system',
        role.id,
        `User answer to “${question.question}” from conversation ${question.threadId}:\n${content}`,
        question.cardId,
        null,
      );
    context.board.record(
      'user_input',
      {
        ...question,
        status: 'answered',
        answer,
        answeredAt: message.createdAt,
        answerMessageId: message.id,
        continuationRequestId: request.id,
      },
      'user',
      'Saved answer and targeted continuation',
    );
    context.board.record('chat_request', request, 'user', 'Queued the asking agent’s continuation');
  })();
  context.publishChat(true);
  void drainConversationQueue(context);
  return request;
}
export function cancelUserQuestion(context: CrewContext, id: string) {
  const question = context.board.get<UserInputRequest>('user_input', id);
  if (question.status !== 'pending')
    throw new Error('This question is no longer awaiting an answer.');
  cancelUserQuestions(context, (q) => q.id === id, 'Question cancelled by the user.');
  void context.drainTasks();
  void drainConversationQueue(context);
  return context.board.get<UserInputRequest>('user_input', id);
}
