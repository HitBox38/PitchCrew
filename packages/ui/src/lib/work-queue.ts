import type { Run, Snapshot, WorkspaceQueue, WorkQueueView } from '@pitchcrew/core';

export const queueStateLabels = {
  ready: 'Ready to start',
  running: 'Working now',
  waiting: 'Waiting for your answer',
  paused: 'Paused',
  blocked: 'Needs attention',
};

/** Workspace slots belong to jobs/conversations, not individual agent processes. */
export const queueSummary = (queue: WorkspaceQueue) => {
  const running = queue.queues.filter((item) => item.state === 'running');
  const ready = queue.queues.filter((item) => item.state === 'ready');
  const held = queue.queues.filter((item) => !['running', 'ready'].includes(item.state));
  const agents = running.flatMap((item) => executingRuns(item.runs));
  return { running, ready, held, agents, available: Math.max(0, queue.concurrency - queue.active) };
};

/** Managed review seat reservations hold capacity but do not execute a provider. */
export const executingRuns = (runs: Run[]) =>
  runs.filter((run) => run.status === 'running' && !run.reviewSeatReservation);

export const runActivityLabel = (run: Run) => {
  const activity =
    run.activity?.findLast((item) => item.status === 'running') ?? run.activity?.at(-1);
  return activity?.kind === 'commentary'
    ? activity.text || activity.label
    : activity?.label || run.message || 'Starting work…';
};

export const queueAnswerThread = (queue: WorkQueueView, data: Snapshot) =>
  data.userInputs?.find(
    (question) =>
      question.status === 'pending' &&
      (queue.cardId
        ? question.cardId === queue.cardId
        : question.threadId === queue.threadId || question.sourceThreadId === queue.threadId),
  )?.threadId ??
  queue.requests.find((request) =>
    request.deliveries.some((delivery) => delivery.status === 'waiting'),
  )?.threadId ??
  queue.threadId;
