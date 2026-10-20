import { z } from 'zod';
import {
  queueSequenceProblems,
  type AgentTask,
  type Card,
  type ChatRequest,
  type Run,
  type WorkQueue,
} from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';
import { drainConversationQueue, saveRequest } from '../conversation-queue.ts';
import { laneId, patchQueue, nextOrder, queueRequests, runLane } from './state.ts';
import { taskLane } from './state.ts';

export function configureQueue(context: CrewContext, data: unknown) {
  const { concurrency } = z.object({ concurrency: z.number().int().min(1).max(50) }).parse(data);
  context.board.record(
    'queue_settings',
    { id: 'workspace', concurrency },
    'user',
    'Changed workspace concurrency',
  );
  void drainConversationQueue(context);
  void context.drainTasks();
  return { concurrency };
}
export function updateQueue(context: CrewContext, id: string, data: unknown) {
  const input = z
    .object({
      action: z.enum(['pause', 'resume', 'stop', 'move', 'retry-follow-up', 'skip-follow-up']),
      beforeId: z.string().nullable().optional(),
      taskId: z.uuid().optional(),
    })
    .parse(data);
  const queue = context.board.get<WorkQueue>('work_queue', id);
  if (input.action === 'retry-follow-up' || input.action === 'skip-follow-up') {
    const task = context.board.get<AgentTask>('task', input.taskId!);
    if (taskLane(context, task) !== id || task.status !== 'failed')
      throw new Error('Choose a failed follow-up in this queue.');
    context.board.db.transaction(() => {
      context.board.record(
        'task',
        {
          ...task,
          status: input.action === 'retry-follow-up' ? 'queued' : 'cancelled',
          runId: null,
          error: '',
        },
        'user',
        'Recovered crew follow-up',
      );
      patchQueue(context, id, {
        paused: false,
        pauseKind: undefined,
        reason: '',
        order: nextOrder(context),
      });
    })();
  } else if (input.action === 'move') {
    if (
      context.board
        .list<Run>('run')
        .some((r) => r.status === 'running' && runLane(context, r) === id)
    )
      throw new Error('Running queues cannot be reordered.');
    const queues = context.board
      .list<WorkQueue>('work_queue')
      .sort((a, b) => a.order - b.order)
      .filter((q) => q.id !== id);
    const position =
      input.beforeId == null ? queues.length : queues.findIndex((q) => q.id === input.beforeId);
    if (position < 0) throw new Error('The destination queue changed. Refresh and try again.');
    queues.splice(position, 0, queue);
    const base = nextOrder(context);
    context.board.db.transaction(() =>
      queues.forEach((q, index) => patchQueue(context, q.id, { order: base + index })),
    )();
  } else {
    if (
      input.action === 'resume' &&
      (queue.pauseKind === 'failed' || queue.pauseKind === 'interrupted') &&
      (queueRequests(context, id).some((r) =>
        r.deliveries.some((d) => d.status === 'failed' || (d.status === 'paused' && d.runId)),
      ) ||
        context.board
          .list<AgentTask>('task')
          .some((t) => t.status === 'failed' && taskLane(context, t) === id))
    )
      throw new Error('Retry or skip the interrupted request or follow-up before continuing.');
    const paused = input.action !== 'resume';
    patchQueue(context, id, {
      paused,
      reason: paused ? 'Paused by you.' : '',
      pauseKind: paused ? 'user' : undefined,
      ...(paused ? {} : { order: nextOrder(context) }),
    });
    if (input.action === 'stop') {
      for (const run of context.board
        .list<Run>('run')
        .filter((r) => r.status === 'running' && runLane(context, r) === id))
        if (context.controllers.has(run.id)) context.cancelRun(run.id);
    }
    if (!paused) {
      for (const request of queueRequests(context, id)) {
        for (const delivery of request.deliveries)
          if (delivery.status === 'paused')
            delivery.status = delivery.runId ? 'cancelled' : 'queued';
        saveRequest(context, request);
      }
    }
  }
  void context.drainTasks();
  void drainConversationQueue(context);
  return context.board.get<WorkQueue>('work_queue', id);
}
export function moveQueueRequest(context: CrewContext, id: string, beforeId: string | null) {
  const request = context.board.get<ChatRequest>('chat_request', id);
  const queueId = laneId(context, request.threadId, request.rootRunId);
  const requests = queueRequests(context, queueId);
  if (request.deliveries.some((d) => d.status === 'running' || d.status === 'waiting'))
    throw new Error('An active request cannot be reordered.');
  const reordered = requests.filter((r) => r.id !== id);
  const position =
    beforeId == null ? reordered.length : reordered.findIndex((r) => r.id === beforeId);
  if (
    position < 0 ||
    (beforeId &&
      reordered[position].deliveries.some((d) => ['running', 'waiting'].includes(d.status)))
  )
    throw new Error('Choose a pending destination.');
  reordered.splice(position, 0, request);
  const cardId = context.board.get<WorkQueue>('work_queue', queueId).cardId;
  if (cardId) {
    const card = context.board.get<Card>('card', cardId);
    const before = queueSequenceProblems(card, requests);
    for (const [key, problem] of queueSequenceProblems(card, reordered))
      if (before.get(key) !== problem) throw new Error(problem);
  }
  const base = Math.max(Date.now(), ...requests.map((r) => r.order + 1));
  context.board.db.transaction(() =>
    reordered.forEach((r, index) => saveRequest(context, { ...r, order: base + index })),
  )();
  void drainConversationQueue(context);
  return context.board.get<ChatRequest>('chat_request', id);
}
