import { boardActionLabels } from '@pitchcrew/core/states';
import type { ReactNode } from 'react';
import type { ChatRequest, Snapshot } from '@pitchcrew/core';
import { EditQueueMessage } from './EditQueueMessage.tsx';
import { QueueDeliveries } from './QueueDeliveries.tsx';
import { QueueRequestActions } from './QueueRequestActions.tsx';
import { useQueueRequest } from '../hooks/useQueueRequest.ts';

export const QueueRequestRow = ({
  request,
  handle,
  queueId,
  data,
}: {
  request: ChatRequest;
  handle: ReactNode;
  queueId: string;
  data: Snapshot;
}) => {
  const model = useQueueRequest(request, queueId);
  const error = request.deliveries.find((delivery) => delivery.error)?.error;
  return (
    <div className="queue-request">
      {handle}
      <div className="min-w-0 flex-1">
        {model.editing ? (
          <EditQueueMessage request={request} close={() => model.setEditing(false)} />
        ) : (
          <>
            <p
              className="queue-request-title line-clamp-3 whitespace-pre-wrap"
              title={request.content}
            >
              {request.boardAction ? boardActionLabels[request.boardAction] : request.content}
            </p>
            {request.routine ? <p className="quiet mt-1 text-xs">Scheduled routine</p> : null}
            <QueueDeliveries request={request} data={data} />
            {error ? <p className="form-error mt-2 text-sm">{error}</p> : null}
          </>
        )}
      </div>
      <QueueRequestActions model={model} />
    </div>
  );
};
