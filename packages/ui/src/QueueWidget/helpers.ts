import type { WorkspaceQueue, WorkQueueView } from '@pitchcrew/core';

export const queueActivityDescription = (agents: number, running: number) => {
  if (!agents) return 'Independent jobs and conversations work in parallel.';
  return `${agents} agent ${agents === 1 ? 'run' : 'runs'} across ${running} active ${running === 1 ? 'queue' : 'queues'}.`;
};

/** Failed or interrupted work waits for Retry or Skip; other held work waits on the user. */
export const queueFailed = (queue: Pick<WorkQueueView, 'state' | 'paused' | 'pauseKind'>) =>
  queue.state === 'blocked' ||
  (queue.paused && (queue.pauseKind === 'failed' || queue.pauseKind === 'interrupted'));

/** "2 of 5 working", with on-hold and failed work said in words rather than painted as slots. */
export const queueTrayLabel = (queue: WorkspaceQueue) => {
  const held = queue.queues.filter((item) => !['running', 'ready'].includes(item.state));
  const failed = held.filter(queueFailed).length;
  const onHold = held.length - failed;
  return [
    `${queue.active} of ${queue.concurrency} working`,
    onHold ? `${onHold} on hold` : '',
    failed ? `${failed} failed` : '',
  ]
    .filter(Boolean)
    .join(' · ');
};

/** At most five sockets: occupied slots first (crew work, then background routines), then free. */
export const traySockets = (queue: Pick<WorkspaceQueue, 'active' | 'background' | 'concurrency'>) =>
  Array.from({ length: Math.min(5, Math.max(queue.concurrency, queue.active)) }, (_, index) =>
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
