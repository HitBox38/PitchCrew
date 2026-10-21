import type { WorkQueueView } from '@pitchcrew/core';

export const queueRequestHeading = (queue: WorkQueueView) => {
  const heading =
    queue.requests.length || queue.tasks.length
      ? `${queue.requests.length} ${queue.requests.length === 1 ? 'request' : 'requests'}${queue.tasks.length ? ` · ${queue.tasks.length} crew ${queue.tasks.length === 1 ? 'follow-up' : 'follow-ups'}` : ''}`
      : 'Add the next action';
  return heading;
};
