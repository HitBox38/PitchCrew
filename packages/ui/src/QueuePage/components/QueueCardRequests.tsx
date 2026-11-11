import { deliveryLifecycle } from '@pitchcrew/core/lifecycles';
import { queueRequestHeading } from '../helpers.ts';
import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@pitchcrew/design-system/accordion';
import { Button } from '@pitchcrew/design-system/button';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { QueueList } from './QueueList.tsx';
import { QueueRequestRow } from './QueueRequestRow.tsx';
import { QueueFollowUps } from './QueueFollowUps.tsx';
import { AddQueueAction } from './AddQueueAction.tsx';
import { useQueueActions } from '@/hooks/useQueueActions.ts';

/** The card footer: request-count disclosure beside Open, expanding into flat request rows. */
export const QueueCardRequests = ({ queue, data }: { queue: WorkQueueView; data: Snapshot }) => {
  const action = useWorkspaceStore((state) => state.action);
  const { open } = useQueueActions(queue);
  const running = queue.state === 'running';
  const hasContent = queue.requests.length || queue.tasks.length || queue.cardId;
  if (!hasContent && !running) return null;
  return (
    <Accordion defaultValue={running ? [] : ['requests']}>
      <AccordionItem value="requests">
        <div className="queue-card-footer" data-running={running}>
          {hasContent ? (
            <AccordionTrigger>{queueRequestHeading(queue)}</AccordionTrigger>
          ) : (
            <p>No queued requests</p>
          )}
          {running ? (
            <Button variant="outline" size="sm" onClick={open}>
              Open
            </Button>
          ) : null}
        </div>
        {hasContent ? (
          <AccordionContent keepMounted className="queue-requests">
            <div className="queue-requests-list">
              <QueueList
                items={queue.requests}
                group={`Requests for ${queue.id}`}
                movable={(request) =>
                  !request.deliveries.some((delivery) =>
                    deliveryLifecycle.is('engaged', delivery.status),
                  )
                }
                commit={(id, beforeId) =>
                  action(`/queue/requests/${id}/order`, 'PUT', { beforeId })
                }
                render={(request, handle, moves) => (
                  <QueueRequestRow
                    request={request}
                    handle={handle}
                    moves={moves}
                    queueId={queue.id}
                    data={data}
                  />
                )}
              />
              <QueueFollowUps tasks={queue.tasks} queueId={queue.id} data={data} />
              {queue.cardId ? <AddQueueAction data={data} cardId={queue.cardId} /> : null}
            </div>
          </AccordionContent>
        ) : null}
      </AccordionItem>
    </Accordion>
  );
};
