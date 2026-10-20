import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { queueIdentity } from '@/lib/work-queue.ts';

export const QueueIdentity = ({ queue, data }: { queue: WorkQueueView; data: Snapshot }) => {
  const identity = queueIdentity(queue, data);
  return (
    <div className="queue-identity min-w-0 flex-1">
      <h3 aria-label={queue.title}>{identity.title}</h3>
      <p>{identity.subtitle}</p>
    </div>
  );
};
