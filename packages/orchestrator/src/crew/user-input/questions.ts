import { randomUUID } from 'node:crypto';
import { userQuestionInput, type Run, type UserInputRequest } from '@pitchcrew/core';
import { canReadConversation, conversations, relatedConversation } from '../conversations.ts';
import type { CrewContext, RunCapability } from '../types.ts';

export function askUser(context: CrewContext, capability: RunCapability, data: unknown) {
  const input = userQuestionInput.parse(data);
  const run = context.board.get<Run>('run', capability.runId);
  if (run.status !== 'running') throw new Error('This execution is no longer active.');
  if (context.board.list<UserInputRequest>('user_input').some((q) => q.runId === run.id))
    throw new Error('This turn already asked a question. Finish the turn and wait for its answer.');
  const sourceThreadId = run.threadId ?? run.roleId;
  if (!canReadConversation(context, run.roleId, sourceThreadId))
    throw new Error('Conversation access was removed.');
  const items = conversations(context);
  let target = items.find((item) => item.id === sourceThreadId);
  const visited = new Set<string>();
  while (target?.kind === 'agent_dm' && target.parentId && !visited.has(target.id)) {
    visited.add(target.id);
    target = items.find((item) => item.id === target!.parentId);
  }
  if (
    !target ||
    ['history', 'agent_dm'].includes(target.kind) ||
    !target.participants.includes(run.roleId) ||
    target.cardId !== run.cardId
  )
    target = relatedConversation(
      context,
      'application',
      run.cardId ?? run.id,
      run.roleId,
      run.cardId,
      'Questions for you',
    );
  const question: UserInputRequest = {
    ...input,
    id: randomUUID(),
    threadId: target.id,
    sourceThreadId,
    roleId: run.roleId,
    runId: run.id,
    messageId: randomUUID(),
    cardId: run.cardId,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  context.board.db.transaction(() => {
    context.board.record('user_input', question, run.roleId, 'Asked the user a question');
    const message = context.addMessage(
      target.id,
      run.roleId,
      'user',
      input.question,
      run.cardId,
      run.id,
      question.messageId,
      'attention',
    );
    context.board.record(
      'message',
      { ...message, userInput: { id: question.id, kind: 'question' } },
      run.roleId,
      'Linked the user question',
    );
  })();
  context.publishChat(true);
  // Give the MCP response time to flush, then end execution even if the CLI keeps working.
  const controller = context.controllers.get(run.id);
  const timer = setTimeout(() => {
    if (controller && context.controllers.get(run.id) === controller) controller.abort();
  }, 250);
  timer.unref();
  return {
    question,
    instruction:
      'Your question is saved. End this turn now. Pitchcrew will continue your task when the user answers.',
  };
}
