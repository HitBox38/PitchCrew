import {
  workQueueId,
  requestPending,
  type ChatRequest,
  type Conversation,
  type QueueSettings,
  type WorkQueue,
  type Run,
  type AgentTask,
  type UserInputRequest,
} from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';

export function concurrency(context: CrewContext): number {
  return context.board.list<QueueSettings>('queue_settings')[0]?.concurrency ?? 5;
}
/** Root/session resolution must not scan and parse every historical run for each queue row. */
function entity<T>(context: CrewContext, kind: string, id: string | undefined): T | undefined {
  if (!id) return undefined;
  const row = context.board.db
    .prepare('SELECT json FROM entities WHERE kind=? AND id=?')
    .get(kind, id) as { json: string } | undefined;
  return row ? (JSON.parse(row.json) as T) : undefined;
}
export function laneId(context: CrewContext, threadId: string, rootRunId?: string): string {
  const item = entity<Conversation>(context, 'conversation', threadId);
  return rootRunId
    ? runLane(context, { cardId: item?.cardId ?? null, threadId, rootRunId, id: rootRunId })
    : workQueueId(item?.cardId ?? null, threadId);
}
export function ensureQueue(context: CrewContext, threadId: string, rootRunId?: string): WorkQueue {
  const id = laneId(context, threadId, rootRunId);
  if (rootRunId) {
    const origin = entity<Run>(context, 'run', rootRunId);
    const request = entity<ChatRequest>(context, 'chat_request', rootRunId);
    if (id.startsWith('conversation:') || id.startsWith('routine:'))
      threadId = request?.threadId ?? origin?.threadId ?? threadId;
  }
  const stored = entity<Conversation>(context, 'conversation', threadId);
  if (stored?.deletedAt) throw new Error('This conversation was deleted.');
  if (!stored) {
    context.board.get('role', threadId);
  }
  const item = stored ?? { cardId: null };

  const previous = entity<WorkQueue>(context, 'work_queue', id);
  if (previous) return previous;
  const queue: WorkQueue = {
    id,
    cardId: item.cardId,
    threadId,
    paused: false,
    reason: '',
    order: nextOrder(context),
    updatedAt: new Date().toISOString(),
  };
  context.board.record('work_queue', queue, 'system', 'Created work queue');
  return queue;
}
export function nextOrder(context: CrewContext): number {
  return Math.max(
    Date.now(),
    ...context.board.list<WorkQueue>('work_queue').map((q) => q.order + 1),
  );
}
export function patchQueue(context: CrewContext, id: string, patch: Partial<WorkQueue>): void {
  const current = context.board.list<WorkQueue>('work_queue').find((q) => q.id === id);
  if (
    !current ||
    Object.entries(patch).every(([key, value]) => current[key as keyof WorkQueue] === value)
  )
    return;
  if (patch.paused) context.queueChains.delete(id);
  context.board.record(
    'work_queue',
    { ...current, ...patch, updatedAt: new Date().toISOString() },
    'system',
    'Updated work queue',
  );
}
export function queueRequests(context: CrewContext, id: string): ChatRequest[] {
  const rows = context.board.db
    .prepare(
      "SELECT e.json FROM entities e WHERE e.kind='chat_request' AND EXISTS (SELECT 1 FROM json_each(e.json,'$.deliveries') d WHERE json_extract(d.value,'$.status') NOT IN ('completed','cancelled'))",
    )
    .all() as { json: string }[];
  return rows
    .map((row) => JSON.parse(row.json) as ChatRequest)
    .filter((r) => laneId(context, r.threadId, r.rootRunId) === id && requestPending(r))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
export function queueWaiting(context: CrewContext, id: string): boolean {
  return context.board.list<UserInputRequest>('user_input').some((q) => {
    if (q.status !== 'pending') return false;
    const run = entity<Run>(context, 'run', q.runId);
    return (run ? runLane(context, run) : workQueueId(q.cardId, q.sourceThreadId)) === id;
  });
}
export function runLane(
  context: CrewContext,
  run: Pick<Run, 'cardId' | 'threadId' | 'rootRunId' | 'id' | 'routineId'>,
): string {
  if (run.cardId) return workQueueId(run.cardId, run.threadId ?? '');
  const root = entity<Run>(context, 'run', run.rootRunId);
  const request = entity<ChatRequest>(context, 'chat_request', run.rootRunId);
  const origin = root || run;
  if (origin.routineId) return `routine:${origin.routineId}`;
  return workQueueId(null, request ? request.threadId : (origin.threadId ?? origin.id));
}
export function taskLane(context: CrewContext, task: AgentTask): string {
  return runLane(context, { ...task, rootRunId: task.rootRunId });
}
/** Include launch reservations and runnable child chains so setup/cleanup cannot overbook. */
export function activeQueues(context: CrewContext): Map<string, Set<string>> {
  const active = new Map<string, Set<string>>();
  const add = (id: string, root: string) => {
    const roots = active.get(id) ?? new Set<string>();
    roots.add(root);
    active.set(id, roots);
  };
  const runs = context.board.list<Run>('run');
  for (const run of runs)
    if (run.status === 'running' || context.controllers.has(run.id))
      add(runLane(context, run), run.rootRunId ?? run.id);
  for (const reservation of context.queueReservations.values())
    add(reservation.lane, reservation.root);
  const tasks = context.board.list<AgentTask>('task');
  for (const [id, root] of context.queueChains) {
    const queue = context.board.list<WorkQueue>('work_queue').find((q) => q.id === id);
    if (
      !queue?.paused &&
      (active.has(id) || active.size < concurrency(context)) &&
      !queueWaiting(context, id) &&
      tasks.some(
        (task) =>
          task.rootRunId === root &&
          task.status === 'queued' &&
          runs.find((r) => r.id === task.parentRunId)?.status === 'completed',
      )
    )
      add(id, root);
  }
  return active;
}
