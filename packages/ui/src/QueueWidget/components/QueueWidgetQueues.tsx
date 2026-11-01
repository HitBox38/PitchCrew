import { Link } from '@tanstack/react-router';
import type { Snapshot, WorkspaceQueue } from '@pitchcrew/core';
import { queueSummary } from '@/lib/work-queue.ts';
import { QueueWidgetWork } from './QueueWidgetWork.tsx';

const previewLimit = 3;

/** Working now, Up next and On hold, each with its full count and up to three rows. */
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
    { title: 'Working now', items: running, empty: 'Nothing is running.' },
    { title: 'Up next', items: ready, empty: 'Nothing is waiting to start.' },
    { title: 'On hold', items: held, empty: 'Nothing is on hold.' },
  ];
  return (
    <div className="queue-widget-work-list">
      {groups.map(({ title, items, empty }) => (
        <section key={title} className="queue-widget-group" aria-label={`${title} queues`}>
          <h3>
            {title} <span className="ui-count">{items.length}</span>
          </h3>
          {items.length ? (
            <ul>
              {items.slice(0, previewLimit).map((item) => (
                <QueueWidgetWork key={item.id} queue={item} data={data} close={close} />
              ))}
            </ul>
          ) : (
            <p className="queue-widget-empty">{empty}</p>
          )}
          {items.length > previewLimit ? (
            <Link to="/queue" className="text-button queue-widget-more" onClick={close}>
              View all {items.length}
            </Link>
          ) : null}
        </section>
      ))}
    </div>
  );
};
