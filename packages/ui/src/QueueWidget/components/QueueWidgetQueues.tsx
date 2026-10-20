import type { Snapshot, WorkspaceQueue } from '@pitchcrew/core';
import { queueSummary } from '@/lib/work-queue.ts';
import { QueueWidgetWork } from './QueueWidgetWork.tsx';

export const QueueWidgetQueues = ({
  queue,
  data,
  close,
}: {
  queue: WorkspaceQueue;
  data: Snapshot;
  close: () => void;
}) => {
  const { running, ready, held } = queueSummary(queue);
  const groups = [
    { title: 'Working now', items: running },
    { title: 'Up next', items: ready },
    { title: 'On hold', items: held },
  ];
  return (
    <div className="queue-widget-work-list">
      {groups.map(({ title, items }) =>
        items.length ? (
          <section key={title} className="queue-widget-group" aria-label={`${title} queues`}>
            <h3>
              {title}
              <span>{items.length}</span>
            </h3>
            <ul>
              {items.map((item) => (
                <QueueWidgetWork key={item.id} queue={item} data={data} close={close} />
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
};
