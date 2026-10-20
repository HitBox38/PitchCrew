import type { WorkspaceQueue } from '@pitchcrew/core';

export const QueueSlots = ({ queue }: { queue: WorkspaceQueue }) => (
  <span
    className="queue-slots"
    data-dense={Math.max(queue.concurrency, queue.active) > 10}
    aria-hidden="true"
  >
    {Array.from({ length: Math.max(queue.concurrency, queue.active) }, (_, index) => (
      <span
        key={index}
        data-state={
          index < queue.active - queue.background
            ? 'working'
            : index < queue.active
              ? 'background'
              : 'available'
        }
      />
    ))}
  </span>
);
