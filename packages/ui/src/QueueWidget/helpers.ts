import type { WorkspaceQueue, WorkQueueView } from '@pitchcrew/core';

export const queueActivityDescription = (agents: number, running: number) => {
  if (!agents) return 'Independent jobs and conversations work in parallel.';
  return `${agents} agent ${agents === 1 ? 'run' : 'runs'} across ${running} active ${running === 1 ? 'queue' : 'queues'}.`;
};

/** Failed or interrupted work waits for Retry or Skip; other held work waits on the user. */
export const queueFailed = (queue: Pick<WorkQueueView, 'state' | 'paused' | 'pauseKind'>) =>
  queue.state === 'blocked' ||
  (queue.paused && (queue.pauseKind === 'failed' || queue.pauseKind === 'interrupted'));

/** Held and failed queues do not occupy workspace slots. */
export const queueAttention = (queue: WorkspaceQueue) => {
  const held = queue.queues.filter((item) => !['running', 'ready'].includes(item.state));
  const failed = held.filter(queueFailed).length;
  return { onHold: held.length - failed, failed };
};

/** A full text equivalent of the slot indicator and its separate attention counts. */
export const queueTrayLabel = (queue: WorkspaceQueue) => {
  const { onHold, failed } = queueAttention(queue);
  return [
    `${queue.active} of ${queue.concurrency} working`,
    onHold ? `${onHold} on hold` : '',
    failed ? `${failed} failed` : '',
  ]
    .filter(Boolean)
    .join(' · ');
};

/** Every slot, including work still finishing after a capacity reduction. */
export const traySockets = (queue: Pick<WorkspaceQueue, 'active' | 'background' | 'concurrency'>) =>
  Array.from({ length: Math.max(queue.concurrency, queue.active) }, (_, index) =>
    index < queue.active - queue.background
      ? ('working' as const)
      : index < queue.active
        ? ('background' as const)
        : ('free' as const),
  );

/** The bead for one job or conversation queue, by the state law: plum working, ochre waiting. */
export const queueBeadTone = (queue: Pick<WorkQueueView, 'state' | 'paused' | 'pauseKind'>) =>
  queue.state === 'running'
    ? 'plum'
    : queueFailed(queue)
      ? 'rose'
      : queue.state === 'waiting'
        ? 'ochre'
        : undefined;
