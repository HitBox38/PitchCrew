import type { AgentTask, ChatRequest, Run, UserInputRequest } from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';

export function questionForRun(context: CrewContext, runId: string) {
  return context.board.list<UserInputRequest>('user_input').find((q) => q.runId === runId);
}
export function waitingOnUser(context: CrewContext, threadId: string, roleId: string) {
  return context.board
    .list<UserInputRequest>('user_input')
    .some((q) => q.sourceThreadId === threadId && q.roleId === roleId && q.status === 'pending');
}
export function endQuestionTurn(context: CrewContext, run: Run): boolean {
  const question = questionForRun(context, run.id);
  if (!question) return false;
  context.streamingMessages.delete(run.id);
  const cancelled = question.status === 'cancelled';
  context.board.record(
    'run',
    {
      ...context.board.get<Run>('run', run.id),
      status: cancelled ? 'cancelled' : 'waiting',
      message: cancelled ? 'Question cancelled.' : 'Waiting for your answer',
      finishedAt: new Date().toISOString(),
    },
    run.roleId,
    cancelled ? 'Cancelled user question' : 'Waiting for user input',
  );
  context.publishChat(true);
  return true;
}
export function finishUserContinuation(context: CrewContext, run: Run): void {
  const finished = context.board.get<Run>('run', run.id);
  if (finished.status !== 'completed' || !run.requestId) return;
  const question = context.board
    .list<UserInputRequest>('user_input')
    .find((q) => q.status === 'answered' && q.continuationRequestId === run.requestId);
  if (!question) return;
  const original = context.board.get<Run>('run', question.runId);
  if (original.status !== 'waiting') return;
  const completed: Run = {
    ...original,
    status: 'completed',
    message: 'Continued after your answer',
    finishedAt: finished.finishedAt,
  };
  context.board.record('run', completed, original.roleId, 'Completed question continuation');
  settleOrigin(context, completed, 'completed');
  // Multiple questions can form a chain; release dependent work only after the last continuation.
  finishUserContinuation(context, completed);
  context.publishChat(true);
}
function settleOrigin(context: CrewContext, run: Run, status: 'completed' | 'cancelled') {
  if (run.requestId) {
    const request = context.board.get<ChatRequest>('chat_request', run.requestId);
    const delivery = request.deliveries.find((d) => d.roleId === run.roleId);
    if (delivery && ['waiting', 'running', 'paused'].includes(delivery.status)) {
      delivery.status = status;
      context.board.record('chat_request', request, 'system', 'Settled waiting delivery');
    }
  }
  if (run.taskId) {
    const task = context.board.get<AgentTask>('task', run.taskId);
    context.board.record(
      'task',
      { ...task, status, error: status === 'cancelled' ? run.message : '' },
      'system',
      'Settled waiting crew task',
    );
  }
}
export function cancelUserQuestions(
  context: CrewContext,
  matches: (q: UserInputRequest) => boolean,
  reason: string,
): void {
  const questions = context.board.list<UserInputRequest>('user_input');
  const selected = new Set(questions.filter(matches).map((q) => q.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const child of questions.filter((q) => selected.has(q.id))) {
      for (const descendant of questions) {
        const descendantRun = context.board.get<Run>('run', descendant.runId);
        if (
          child.continuationRequestId &&
          descendantRun.requestId === child.continuationRequestId &&
          !selected.has(descendant.id)
        ) {
          selected.add(descendant.id);
          changed = true;
        }
      }
      const origin = context.board.get<Run>('run', child.runId);
      const parent = questions.find(
        (q) => q.continuationRequestId === origin.requestId && origin.requestId,
      );
      if (parent && !selected.has(parent.id)) {
        selected.add(parent.id);
        changed = true;
      }
    }
  }
  for (const q of questions) {
    const run = context.board.get<Run>('run', q.runId);
    if (
      !selected.has(q.id) ||
      q.status === 'cancelled' ||
      (q.status === 'answered' && run.status === 'completed')
    )
      continue;
    context.board.record(
      'user_input',
      { ...q, status: 'cancelled', cancellationReason: reason },
      'user',
      reason,
    );
    context.controllers.get(run.id)?.abort();
    if (q.continuationRequestId) {
      const request = context.board.get<ChatRequest>('chat_request', q.continuationRequestId);
      for (const delivery of request.deliveries) {
        if (delivery.runId) context.controllers.get(delivery.runId)?.abort();
        if (!['completed', 'cancelled'].includes(delivery.status)) delivery.status = 'cancelled';
      }
      context.board.record('chat_request', request, 'user', reason);
    }
    if (run.status === 'waiting') {
      const cancelled: Run = { ...run, status: 'cancelled', message: reason };
      context.board.record('run', cancelled, 'user', reason);
      settleOrigin(context, cancelled, 'cancelled');
    }
  }
  context.publishChat(true);
}
