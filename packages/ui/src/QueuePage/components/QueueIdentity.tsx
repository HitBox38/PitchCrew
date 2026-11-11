import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { queueIdentity, queueStateLabels, queueTone } from '@/lib/work-queue.ts';

/** Company and role (or conversation), with the queue's state bead and words. */
export const QueueIdentity = ({ queue, data }: { queue: WorkQueueView; data: Snapshot }) => {
  const identity = queueIdentity(queue, data);
  const tone = queueTone(queue);
  return (
    <div className="queue-identity">
      <span
        className="clay-bead"
        data-size="sm"
        data-tone={tone}
        data-empty={tone ? undefined : ''}
        data-live={queue.state === 'running' ? '' : undefined}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <h3 aria-label={queue.title}>{identity.title}</h3>
        <p>
          {identity.subtitle}
          <span className={`queue-state queue-state-${queue.state}`}>
            {queueStateLabels[queue.state]}
          </span>
        </p>
      </div>
    </div>
  );
};
