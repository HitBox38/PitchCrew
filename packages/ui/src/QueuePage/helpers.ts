import type { WorkQueueView } from '@pitchcrew/core';

export const queueRequestHeading = (queue: WorkQueueView) =>
  queue.requests.length || queue.tasks.length
    ? `${queue.requests.length} ${queue.requests.length === 1 ? 'request' : 'requests'}${queue.tasks.length ? ` · ${queue.tasks.length} crew ${queue.tasks.length === 1 ? 'follow-up' : 'follow-ups'}` : ''}`
    : 'Add the next action';

/**
 * The bead for a whole queue: plum while an agent works, ochre when the user must answer or
 * finish a prerequisite or recover an interruption, rose only when work failed and a hollow socket
 * when ready or paused by you.
 */
export const queueTone = (
  queue: Pick<WorkQueueView, 'state' | 'pauseKind'>,
): 'plum' | 'ochre' | 'rose' | undefined =>
  queue.state === 'running'
    ? 'plum'
    : queue.pauseKind === 'failed'
      ? 'rose'
      : queue.state === 'waiting' || queue.state === 'blocked' || queue.pauseKind === 'interrupted'
        ? 'ochre'
        : undefined;

export const slotFact = (active: number, concurrency: number) =>
  `${active} of ${concurrency} ${concurrency === 1 ? 'slot' : 'slots'}`;

export const backgroundLine = (count: number) =>
  `${count} background ${count === 1 ? 'routine is' : 'routines are'} also running`;
