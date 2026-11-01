import { QueueRequestContextMenu } from './QueueRequestContextMenu.tsx';
import { boardActionLabels } from '@pitchcrew/core/states';
import type { ReactNode } from 'react';
import type { ChatRequest, Snapshot } from '@pitchcrew/core';
import { EditQueueMessage } from './EditQueueMessage.tsx';
import { QueueDeliveries } from './QueueDeliveries.tsx';
import { QueueRequestActions } from './QueueRequestActions.tsx';
import { QueueRequestRecovery } from './QueueRequestRecovery.tsx';
import { useQueueRequest } from '../hooks/useQueueRequest.ts';
import type { QueueMoves } from '../types.ts';

/** One flat request row: handle, text with recipients, trailing menu; recovery underneath. */
export const QueueRequestRow = ({
  request,
  handle,
  moves,
  queueId,
  data,
}: {
  request: ChatRequest;
  handle: ReactNode;
  moves: QueueMoves;
  queueId: string;
  data: Snapshot;
}) => {
  const model = useQueueRequest(request, queueId, moves);
  const error = request.deliveries.find((delivery) => delivery.error)?.error;
  return (
    <QueueRequestContextMenu model={model}>
      <div className="queue-request">
        {handle}
        <div className="queue-request-body">
          {model.editing ? (
            <EditQueueMessage request={request} close={() => model.setEditing(false)} />
          ) : (
            <>
              <p className="queue-request-title" title={request.content}>
                {request.boardAction ? boardActionLabels[request.boardAction] : request.content}
              </p>
              {request.routine ? <p className="queue-request-note">Scheduled routine</p> : null}
              <QueueDeliveries request={request} data={data} />
              {error ? <p className="queue-request-error">{error}</p> : null}
              <QueueRequestRecovery model={model} />
            </>
          )}
        </div>
        <QueueRequestActions model={model} />
      </div>
    </QueueRequestContextMenu>
  );
};
