import { type Card, type Conversation, type WorkQueue, type WorkspaceQueue } from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';
import { activeRuns, tasksWithStatus } from './queries.ts';
import {
  activeQueues,
  concurrency,
  queueRequests,
  queueWaiting,
  runLane,
  taskLane,
} from './state.ts';

export const workspaceQueue = (context: CrewContext): WorkspaceQueue => {
  const active = activeQueues(context);
  const cards = context.board.list<Card>('card');
  const conversations = context.board.list<Conversation>('conversation');
  const workQueues = context.board.list<WorkQueue>('work_queue');
  const runs = activeRuns(context);
  const tasks = tasksWithStatus(context, [
    'queued',
    'running',
    'waiting',
    ...(workQueues.some((queue) => queue.paused) ? ['failed' as const] : []),
  ]);
  const queues = workQueues
    .flatMap((queue) => {
      if (queue.id.startsWith('routine:')) return [];
      if (
        queue.cardId
          ? !cards.some((c) => c.id === queue.cardId)
          : !conversations.some((c) => c.id === queue.threadId)
      )
        return [];
      const requests = queueRequests(context, queue.id);
      const relatedRuns = runs.filter(
        (r) =>
          (r.status === 'running' || context.controllers.has(r.id)) &&
          runLane(context, r) === queue.id,
      );
      const relatedTasks = tasks.filter(
        (t) =>
          (['queued', 'running', 'waiting'].includes(t.status) ||
            (queue.paused && t.status === 'failed')) &&
          taskLane(context, t) === queue.id,
      );
      if (!requests.length && !relatedRuns.length && !relatedTasks.length) return [];
      const waiting = queueWaiting(context, queue.id);
      const state = relatedRuns.length
        ? ('running' as const)
        : waiting
          ? ('waiting' as const)
          : queue.paused
            ? ('paused' as const)
            : queue.reason
              ? ('blocked' as const)
              : ('ready' as const);
      return [
        {
          ...queue,
          title: queue.cardId
            ? `${cards.find((c) => c.id === queue.cardId)!.company}: ${cards.find((c) => c.id === queue.cardId)!.title}`
            : conversations.find((c) => c.id === queue.threadId)!.title,
          state,
          requests,
          runs: relatedRuns,
          tasks: relatedTasks,
        },
      ];
    })
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return {
    concurrency: concurrency(context),
    active: active.size,
    background: [...active.keys()].filter((id) => id.startsWith('routine:')).length,
    queues,
  };
};
