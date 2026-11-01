import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { QueueCard } from './QueueCard.tsx';
import { QueueList } from './QueueList.tsx';
import { QueueSection } from './QueueSection.tsx';

/** Ready and held queues reorder independently; each keeps its own saved position. */
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
  const commit = (id: string, beforeId: string | null) =>
    action(`/queue/${encodeURIComponent(id)}`, 'PUT', { action: 'move', beforeId });
  const groups = [
    ['Ready work', 'Up next', ready, 'Nothing is waiting for a slot.', 'Workspace waiting order'],
    ['Work on hold', 'On hold', held, 'Nothing is on hold.', 'Workspace held order'],
  ] as const;
  return groups.map(([label, title, items, empty, group]) => (
    <QueueSection key={label} label={label} title={title} count={items.length} empty={empty}>
      {items.length ? (
        <QueueList
          items={items}
          group={group}
          className="queue-grid ui-tray"
          commit={commit}
          render={(queue, handle, moves) => (
            <QueueCard queue={queue} data={data} handle={handle} moves={moves} />
          )}
        />
      ) : null}
    </QueueSection>
  ));
};
