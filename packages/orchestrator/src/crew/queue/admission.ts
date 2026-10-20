import { randomUUID } from 'node:crypto';
import { type Run, type WorkQueue } from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';
import { activeQueues, concurrency, runLane, queueWaiting } from './state.ts';

export class QueueBusyError extends Error {}
export interface LaunchScope {
  isolated?: boolean;
  cardId: string | null;
  threadId: string;
  roleId: string;
  rootRunId?: string;
  routineId?: string;
}
export function launchProblem(context: CrewContext, input: LaunchScope): string {
  const lane =
    input.routineId && !input.cardId
      ? `routine:${input.routineId}`
      : runLane(context, { ...input, id: input.rootRunId ?? input.threadId });
  const queue = context.board.list<WorkQueue>('work_queue').find((q) => q.id === lane);
  if (queue?.paused) return queue.reason || 'This queue is paused.';
  if (queueWaiting(context, lane)) return 'Waiting for your answer.';
  const active = activeQueues(context);
  const roots = active.get(lane);
  if (roots && (!input.rootRunId || [...roots].some((root) => root !== input.rootRunId)))
    return 'This job or conversation already has active work.';
  if (!roots && active.size >= concurrency(context)) return 'Waiting for workspace capacity.';
  const runs = context.board.list<Run>('run');
  if (
    !input.isolated &&
    runs.some(
      (r) =>
        (r.status === 'running' || context.controllers.has(r.id)) &&
        r.threadId === input.threadId &&
        r.roleId === input.roleId &&
        !r.reviewSeatReservation,
    )
  )
    return 'This conversation participant already has an active turn.';
  if (
    !input.isolated &&
    [...context.queueReservations.values()].some(
      (r) => r.thread === input.threadId && r.role === input.roleId,
    )
  )
    return 'This conversation participant is starting a turn.';
  return '';
}
export async function reserveLaunch<T extends { id: string; rootRunId?: string }>(
  context: CrewContext,
  input: LaunchScope,
  launch: () => Promise<T>,
): Promise<T> {
  const problem = launchProblem(context, input);
  if (problem) throw new QueueBusyError(problem);
  const key = randomUUID();
  const lane =
    input.routineId && !input.cardId
      ? `routine:${input.routineId}`
      : runLane(context, { ...input, id: key });
  context.queueReservations.set(key, {
    lane,
    root: input.rootRunId ?? key,
    thread: input.threadId,
    role: input.roleId,
  });
  try {
    const result = await launch();
    context.queueChains.set(lane, result.rootRunId ?? result.id);
    return result;
  } finally {
    context.queueReservations.delete(key);
  }
}
