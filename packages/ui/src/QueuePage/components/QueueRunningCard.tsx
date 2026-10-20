import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { executingRuns } from '@/lib/work-queue.ts';
import { QueueRun } from './QueueRun.tsx';
import { QueueRunningMenu } from './QueueRunningMenu.tsx';
import { QueueCardRequests } from './QueueCardRequests.tsx';
import { QueueIdentity } from './QueueIdentity.tsx';

export const QueueRunningCard = ({ queue, data }: { queue: WorkQueueView; data: Snapshot }) => {
  const runs = executingRuns(queue.runs);
  return (
    <article className="queue-card" data-state="running" aria-label={queue.title}>
      <div className="queue-running-card-heading">
        <QueueIdentity queue={queue} data={data} />
        <QueueRunningMenu queue={queue} />
      </div>
      {queue.reason ? <p className="queue-reason">{queue.reason}</p> : null}
      {runs.length ? (
        <ul className="queue-agent-runs" aria-label="Agents working in this queue">
          {runs.map((run) => (
            <QueueRun key={run.id} run={run} data={data} />
          ))}
        </ul>
      ) : (
        <p className="queue-reason">Preparing the next step…</p>
      )}
      <QueueCardRequests queue={queue} data={data} />
    </article>
  );
};
