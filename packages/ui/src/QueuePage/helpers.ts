import type { WorkQueueView } from '@pitchcrew/core';

export const queueRequestHeading = (queue: WorkQueueView) =>
  queue.requests.length || queue.tasks.length
    ? `${queue.requests.length} ${queue.requests.length === 1 ? 'request' : 'requests'}${queue.tasks.length ? ` · ${queue.tasks.length} crew ${queue.tasks.length === 1 ? 'follow-up' : 'follow-ups'}` : ''}`
    : 'Add the next action';

export const slotFact = (active: number, concurrency: number) =>
  `${active} of ${concurrency} ${concurrency === 1 ? 'slot' : 'slots'}`;

export const backgroundLine = (count: number) =>
  `${count} background ${count === 1 ? 'routine is' : 'routines are'} also running`;
