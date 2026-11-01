import type { Snapshot, WorkspaceQueue, WorkQueueView } from '@pitchcrew/core';
import { backgroundLine } from '../helpers.ts';
import { QueueCard } from './QueueCard.tsx';
import { QueueSection } from './QueueSection.tsx';

export const QueueWorking = ({
  running,
  agents,
  queue,
  data,
}: {
  running: WorkQueueView[];
  agents: number;
  queue: WorkspaceQueue;
  data: Snapshot;
}) => (
  <QueueSection
    label="Running work"
    title="Working now"
    count={running.length}
    empty="Nothing is running."
  >
    <p className="sr-only">
      {agents} agent runs across {running.length} active queues.
    </p>
    {running.length ? (
      <div className="queue-grid ui-tray">
        {running.map((q) => (
          <QueueCard key={q.id} queue={q} data={data} />
        ))}
      </div>
    ) : null}
    {queue.background ? (
      <p className="queue-background-note">
        <span className="clay-bead" data-size="sm" data-tone="plum" aria-hidden="true" />
        {backgroundLine(queue.background)}, outside these queues
      </p>
    ) : null}
  </QueueSection>
);
