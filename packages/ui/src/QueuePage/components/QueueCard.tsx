import { QueueFollowUps } from './QueueFollowUps.tsx';
import type { ReactNode } from 'react';
import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { AccordionSection } from '@/components/ui/accordion/index.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { QueueCardHeading } from './QueueCardHeading.tsx';
import { QueueList } from './QueueList.tsx';
import { QueueRequestRow } from './QueueRequestRow.tsx';
import { AddQueueAction } from './AddQueueAction.tsx';
import { QueueRun } from './QueueRun.tsx';
import { executingRuns, queueAnswerThread } from '@/lib/work-queue.ts';

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
  const runs = executingRuns(queue.runs);
  return (
    <article className="queue-card" data-state={queue.state} aria-label={queue.title}>
      <QueueCardHeading
        queue={queue}
        handle={handle}
        answerThreadId={queue.state === 'waiting' ? queueAnswerThread(queue, data) : undefined}
      />
      {queue.reason ? (
        <p className="queue-reason" role={queue.state === 'blocked' ? 'status' : undefined}>
          {queue.reason}
        </p>
      ) : null}
      {runs.length ? (
        <ul className="queue-agent-runs" aria-label="Agents working in this queue">
          {runs.map((run) => (
            <QueueRun key={run.id} run={run} data={data} />
          ))}
        </ul>
      ) : queue.state === 'running' ? (
        <p className="queue-reason">Preparing the next step…</p>
      ) : null}
      {queue.requests.length || queue.tasks.length || queue.cardId ? (
        <AccordionSection
          heading={
            queue.requests.length || queue.tasks.length
              ? `${queue.requests.length} ${queue.requests.length === 1 ? 'request' : 'requests'}${queue.tasks.length ? ` · ${queue.tasks.length} crew follow-ups` : ''}`
              : 'Add the next action'
          }
          triggerClassName="px-4"
          defaultOpen={queue.state !== 'running'}
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
      ) : null}
    </article>
  );
};
