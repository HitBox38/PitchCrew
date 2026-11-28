import { deliveryLifecycle, type AgentTask, type ChatRequest, type Run } from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';
import { openRoundRoots, refreshOpenRounds } from '../delegation-rounds.ts';
import { cancelUserQuestions } from '../user-input/lifecycle.ts';
import { ensureQueue, patchQueue, queueRequests, saveRequest } from './state.ts';

const stopConversationBranch = (
  context: CrewContext,
  id: string,
  roleId?: string,
  rootId?: string,
): void => {
  const runs = context.board.list<Run>('run');
  const tasks = context.board.list<AgentTask>('task');
  const roots = new Set(
    rootId
      ? [rootId]
      : [
          ...runs.filter((run) => run.threadId === id).map((run) => run.rootRunId ?? run.id),
          ...openRoundRoots(context, id),
        ],
  );
  const owned = runs.filter(
    (run) => roots.has(run.rootRunId ?? run.id) && (!roleId || run.roleId === roleId),
  );
  const branches = new Set(owned.map((run) => run.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of tasks)
      if (branches.has(task.parentRunId) && task.runId && !branches.has(task.runId)) {
        branches.add(task.runId);
        changed = true;
      }
  }
  cancelUserQuestions(
    context,
    (q) =>
      roleId
        ? branches.has(q.runId) ||
          ((q.threadId === id || q.sourceThreadId === id) && q.roleId === roleId)
        : roots.has(runs.find((run) => run.id === q.runId)?.rootRunId ?? q.runId) ||
          q.threadId === id ||
          q.sourceThreadId === id,
    'Question cancelled because this work was stopped.',
  );
  for (const run of runs)
    if (
      run.status === 'running' &&
      (roleId ? branches.has(run.id) : roots.has(run.rootRunId ?? run.id))
    ) {
      context.controllers.get(run.id)?.abort();
      context.streamingMessages.delete(run.id);
    }
  for (const task of tasks)
    if (
      task.status === 'queued' &&
      (roleId
        ? branches.has(task.parentRunId) || (roots.has(task.rootRunId) && task.roleId === roleId)
        : roots.has(task.rootRunId))
    )
      context.board.record(
        'task',
        { ...task, status: 'cancelled', error: 'Stopped by the user.' },
        'user',
        'Cancelled delegated work',
      );
  refreshOpenRounds(context);
  for (const request of context.board
    .list<ChatRequest>('chat_request')
    .filter((request) => request.threadId === id && (!rootId || request.id === rootId))) {
    let changed = false;
    for (const delivery of request.deliveries)
      if (
        (!roleId || delivery.roleId === roleId) &&
        deliveryLifecycle.is('moving', delivery.status)
      ) {
        delivery.status = 'paused';
        changed = true;
      }
    if (changed) saveRequest(context, request);
  }
  context.publishChat(true);
};

export const stopConversationWork = (
  context: CrewContext,
  id: string,
  roleId?: string,
  rootId?: string,
  effect: (action: () => void) => void = (action) => action(),
): void => {
  if (roleId) return stopConversationBranch(context, id, roleId, rootId);
  const queue = ensureQueue(context, id);
  patchQueue(
    context,
    queue.id,
    { paused: true, pauseKind: 'user', reason: 'Paused by you.' },
    effect,
  );
  const runs = context.board.list<Run>('run');
  const owned = runs.filter(
    (run) =>
      (queue.cardId ? run.cardId === queue.cardId : run.threadId === id) &&
      (!rootId || (run.rootRunId ?? run.id) === rootId),
  );
  const roots = new Set([
    ...owned.map((run) => run.rootRunId ?? run.id),
    ...(rootId ? [] : openRoundRoots(context, id)),
  ]);
  cancelUserQuestions(
    context,
    (q) => roots.has(runs.find((run) => run.id === q.runId)?.rootRunId ?? q.runId),
    'Stopped by you.',
    effect,
  );
  for (const run of runs)
    if (roots.has(run.rootRunId ?? run.id)) {
      effect(() => {
        context.controllers.get(run.id)?.abort();
        context.streamingMessages.delete(run.id);
      });
    }
  for (const task of context.board.list<AgentTask>('task'))
    if (roots.has(task.rootRunId) && task.status === 'queued')
      context.board.record(
        'task',
        { ...task, status: 'cancelled', error: 'Stopped by you.' },
        'user',
        'Cancelled crew follow-up',
      );
  refreshOpenRounds(context);
  for (const request of queueRequests(context, queue.id)) {
    for (const entry of request.deliveries) {
      if (entry.status === 'running') entry.status = 'paused';
      else if (entry.status === 'queued') entry.status = 'paused';
    }
    saveRequest(context, request, false);
  }
  effect(() => context.publishChat(true));
};
