import { QueueFollowUps } from './QueueFollowUps.tsx';
import type { ReactNode } from 'react';
import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { AccordionSection } from '@/components/ui/accordion/index.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { QueueCardHeading } from './QueueCardHeading.tsx';
import { QueueList } from './QueueList.tsx';
import { QueueRequestRow } from './QueueRequestRow.tsx';
import { AddQueueAction } from './AddQueueAction.tsx';

export const QueueCard = ({
  queue,
  data,
  handle,
}: {
  queue: WorkQueueView;
  data: Snapshot;
  handle?: ReactNode;
}) => {
  const action = useWorkspaceStore((s) => s.action);
  return (
    <article className="queue-card" aria-label={queue.title}>
      <QueueCardHeading queue={queue} handle={handle} />
      {queue.reason ? (
        <p className="queue-reason" role={queue.state === 'blocked' ? 'status' : undefined}>
          {queue.reason}
        </p>
      ) : null}
      {queue.runs.map((run) => (
        <p className="quiet px-4 pb-2 text-sm" key={run.id}>
          {run.roleId}: {run.message}
        </p>
      ))}
      <AccordionSection
        heading={`${queue.requests.length} ${queue.requests.length === 1 ? 'request' : 'requests'}`}
        triggerClassName="px-4"
        defaultOpen
        contentClassName="px-2 pb-3"
      >
        <QueueList
          items={queue.requests}
          group={`Requests for ${queue.id}`}
          movable={(r) => !r.deliveries.some((d) => ['running', 'waiting'].includes(d.status))}
          commit={(id, beforeId) => action(`/queue/requests/${id}/order`, 'PUT', { beforeId })}
          render={(request, grip) => (
            <QueueRequestRow request={request} handle={grip} queueId={queue.id} />
          )}
        />
        <QueueFollowUps tasks={queue.tasks} queueId={queue.id} />
        {queue.cardId ? (
          <div className="px-3 pt-2">
            <AddQueueAction data={data} cardId={queue.cardId} />
          </div>
        ) : null}
      </AccordionSection>
    </article>
  );
};
