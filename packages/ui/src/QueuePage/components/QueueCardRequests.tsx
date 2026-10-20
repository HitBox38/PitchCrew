import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion/index.tsx';
import { Button } from '@/components/ui/button/index.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { QueueList } from './QueueList.tsx';
import { QueueRequestRow } from './QueueRequestRow.tsx';
import { QueueFollowUps } from './QueueFollowUps.tsx';
import { AddQueueAction } from './AddQueueAction.tsx';
import { useQueueActions } from '@/hooks/useQueueActions.ts';

export const QueueCardRequests = ({ queue, data }: { queue: WorkQueueView; data: Snapshot }) => {
  const action = useWorkspaceStore((state) => state.action);
  const { open } = useQueueActions(queue);
  const running = queue.state === 'running';
  const hasContent = queue.requests.length || queue.tasks.length || queue.cardId;
  const heading =
    queue.requests.length || queue.tasks.length
      ? `${queue.requests.length} ${queue.requests.length === 1 ? 'request' : 'requests'}${queue.tasks.length ? ` · ${queue.tasks.length} crew ${queue.tasks.length === 1 ? 'follow-up' : 'follow-ups'}` : ''}`
      : 'Add the next action';
  if (!hasContent && !running) return null;
  return (
    <Accordion defaultValue={running ? [] : ['requests']}>
      <AccordionItem value="requests">
        <div className="queue-card-footer" data-running={running}>
          {hasContent ? <AccordionTrigger>{heading}</AccordionTrigger> : <p>No queued requests</p>}
          {running ? (
            <Button variant="outline" size="sm" onClick={open}>
              Open
            </Button>
          ) : null}
        </div>
        {hasContent ? (
          <AccordionContent keepMounted className="px-2 pb-3">
            <QueueList
              items={queue.requests}
              group={`Requests for ${queue.id}`}
              movable={(request) =>
                !request.deliveries.some((delivery) =>
                  ['running', 'waiting'].includes(delivery.status),
                )
              }
              commit={(id, beforeId) => action(`/queue/requests/${id}/order`, 'PUT', { beforeId })}
              render={(request, handle) => (
                <QueueRequestRow request={request} handle={handle} queueId={queue.id} data={data} />
              )}
            />
            <QueueFollowUps tasks={queue.tasks} queueId={queue.id} data={data} />
            {queue.cardId ? (
              <div className="px-3 pt-2">
                <AddQueueAction data={data} cardId={queue.cardId} />
              </div>
            ) : null}
          </AccordionContent>
        ) : null}
      </AccordionItem>
    </Accordion>
  );
};
