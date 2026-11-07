import type { ChatRequest, Snapshot } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';
import { QueueContents } from './QueueContents.tsx';
import { QueuedMessage } from './QueuedMessage.tsx';

export const QueuedMessageList = ({
  queued,
  ...props
}: {
  queued: ChatRequest[];
  data: Snapshot;
  action: Action;
  working: boolean;
  onEdit: (request: ChatRequest) => void;
}) => (
  <QueueContents>
    {queued.map((request, index) => (
      <QueuedMessage
        key={request.id}
        request={request}
        {...props}
        canMoveEarlier={
          index > 0 &&
          !queued[index - 1]!.deliveries.some((delivery) =>
            ['running', 'waiting'].includes(delivery.status),
          )
        }
        canMoveLater={index < queued.length - 1}
      />
    ))}
  </QueueContents>
);
