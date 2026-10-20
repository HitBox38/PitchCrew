import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { QueueCard } from './QueueCard.tsx';
import { QueueList } from './QueueList.tsx';
import { QueueSectionHeading } from './QueueSectionHeading.tsx';

export const QueuePending = ({
  ready,
  held,
  data,
}: {
  ready: WorkQueueView[];
  held: WorkQueueView[];
  data: Snapshot;
}) => {
  const action = useWorkspaceStore((state) => state.action);
  return (
    <div
      className="queue-pending-grid"
      data-has-held={held.length > 0}
      data-has-ready={ready.length > 0}
    >
      <section aria-label="Ready work">
        <QueueSectionHeading title="Up next" count={ready.length}>
          Drag to set priority. Each job keeps its own action order.
        </QueueSectionHeading>
        {ready.length ? (
          <QueueList
            items={ready}
            group="Workspace waiting order"
            commit={(id, beforeId) =>
              action(`/queue/${encodeURIComponent(id)}`, 'PUT', { action: 'move', beforeId })
            }
            render={(queue, handle) => <QueueCard queue={queue} data={data} handle={handle} />}
          />
        ) : (
          <p className="queue-section-empty">No work waiting for a slot.</p>
        )}
      </section>
      {held.length ? (
        <section aria-label="Work on hold">
          <QueueSectionHeading title="On hold" count={held.length}>
            These queues release their slots so other work can continue.
          </QueueSectionHeading>
          <QueueList
            items={held}
            group="Workspace held order"
            commit={(id, beforeId) =>
              action(`/queue/${encodeURIComponent(id)}`, 'PUT', { action: 'move', beforeId })
            }
            render={(queue, handle) => <QueueCard queue={queue} data={data} handle={handle} />}
          />
        </section>
      ) : null}
    </div>
  );
};
