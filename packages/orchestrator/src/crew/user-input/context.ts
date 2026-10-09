import type { AgentTask, ChatMessage, ChatRequest, Run, UserInputRequest } from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';
/** Follow saved answer provenance instead of nesting earlier continuation prompts into new ones. */
export function questionTaskOrigin(context: CrewContext, initial: Run): Run {
  let run = initial;
  const visited = new Set<string>();
  while (!visited.has(run.id)) {
    visited.add(run.id);
    if (!run.requestId) return run;
    const request = context.board.get<ChatRequest>('chat_request', run.requestId);
    if (!request.userInputId) return run;
    const question = context.board.get<UserInputRequest>('user_input', request.userInputId);
    run = context.board.get<Run>('run', question.runId);
  }
  throw new Error('The question continuation contains invalid provenance. Start a new request.');
}
export function originalQuestionTask(context: CrewContext, initial: Run): string {
  const run = questionTaskOrigin(context, initial);
  if (run.requestId) return context.board.get<ChatRequest>('chat_request', run.requestId).content;
  if (run.taskId) return context.board.get<AgentTask>('task', run.taskId).content;
  const message = context.board
    .list<ChatMessage>('message')
    .find((message) => message.runId === run.id && ['user', 'system'].includes(message.from));
  return message?.content ?? 'Continue the task described in the conversation and attached job.';
}
export function questionContinuationAllowed(context: CrewContext, initial: Run): boolean {
  const run = questionTaskOrigin(context, initial);
  return (
    !run.taskId || context.taskPermissionsAllow(context.board.get<AgentTask>('task', run.taskId))
  );
}
