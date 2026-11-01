import type { ReactNode } from 'react';
import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { queueAnswerThread } from '@/lib/work-queue.ts';
import { QueueCardHeading } from './QueueCardHeading.tsx';
import { QueueRunningCard } from './QueueRunningCard.tsx';
import { QueueCardRequests } from './QueueCardRequests.tsx';
import type { QueueMoves } from '../types.ts';

export const QueueCard = ({
  queue,
  data,
  handle,
  moves = {},
}: {
  queue: WorkQueueView;
  data: Snapshot;
  handle?: ReactNode;
  moves?: QueueMoves;
}) => {
  if (queue.state === 'running') return <QueueRunningCard queue={queue} data={data} />;
  return (
    <article className="queue-card" data-state={queue.state} aria-label={queue.title}>
      <QueueCardHeading
        queue={queue}
        data={data}
        handle={handle}
        moves={moves}
        answerThreadId={queue.state === 'waiting' ? queueAnswerThread(queue, data) : undefined}
      />
      {queue.reason ? (
        <p className="queue-reason" role={queue.state === 'blocked' ? 'status' : undefined}>
          {queue.reason}
        </p>
      ) : null}
      <QueueCardRequests queue={queue} data={data} />
    </article>
  );
};
