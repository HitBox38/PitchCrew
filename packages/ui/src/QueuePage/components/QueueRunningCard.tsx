import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { executingRuns } from '@/lib/work-queue.ts';
import { QueueRun } from './QueueRun.tsx';
import { QueueRunningMenu } from './QueueRunningMenu.tsx';
import { QueueCardRequests } from './QueueCardRequests.tsx';

export const QueueRunningCard = ({ queue, data }: { queue: WorkQueueView; data: Snapshot }) => {
  const card = data.cards.find((item) => item.id === queue.cardId);
  const runs = executingRuns(queue.runs);
  return (
    <article className="queue-card" data-state="running" aria-label={queue.title}>
      <div className="queue-running-card-heading">
        <div className="min-w-0 flex-1">
          <h3>{card?.company ?? queue.title}</h3>
          <p>{card?.title ?? 'Conversation'}</p>
        </div>
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
