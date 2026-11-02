import { Link } from '@tanstack/react-router';
import type { Snapshot, WorkspaceQueue } from '@pitchcrew/core';
import { PopoverDescription, PopoverTitle } from '@pitchcrew/design-system/popover';
import { queueSummary } from '@/lib/work-queue.ts';
import { queueActivityDescription } from '../helpers.ts';
import { QueueCapacityMeter } from './QueueCapacityMeter.tsx';
import { QueueWidgetQueues } from './QueueWidgetQueues.tsx';

export const QueuePanel = ({
  queue,
  data,
  close,
}: {
  queue: WorkspaceQueue;
  data: Snapshot;
  close: () => void;
}) => {
  const { running, agents, available } = queueSummary(queue);
  return (
    <>
      <header className="queue-widget-heading">
        <PopoverTitle>Work queue</PopoverTitle>
        <span className="ui-count">
          {queue.active} of {queue.concurrency} slots
        </span>
      </header>
      <PopoverDescription className="queue-widget-description">
        {queueActivityDescription(agents.length, running.length)}
      </PopoverDescription>
      <div className="queue-widget-capacity">
        <QueueCapacityMeter queue={queue} />
        <span>
          {queue.active} working · {available} free
        </span>
      </div>
      <QueueWidgetQueues queue={queue} data={data} close={close} />
      {queue.background ? (
        <p className="queue-widget-background">
          <span className="clay-bead" data-size="sm" data-tone="plum" aria-hidden="true" />
          {queue.background} background {queue.background === 1 ? 'routine' : 'routines'} running
        </p>
      ) : null}
      <footer className="queue-widget-footer">
        <Link to="/queue" className="text-button" onClick={close}>
          Open queue
        </Link>
      </footer>
    </>
  );
};
