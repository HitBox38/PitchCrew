import type { ChatRequest } from '@pitchcrew/core';
import { QueuedMessageMenu } from './QueuedMessageMenu.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { Pencil } from 'lucide-react';
import { requestRecovery } from '../queue-recovery.ts';
export const QueuedMessageActions = ({
  request,
  editable,
  working,
  busy,
  update,
  edit,
  canMoveEarlier,
  canMoveLater,
  queuePaused,
  canResume,
}: {
  request: ChatRequest;
  editable: boolean;
  working: boolean;
  busy: boolean;
  update: (command: string) => Promise<unknown>;
  edit: () => void;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  queuePaused: boolean;
  canResume: boolean;
}) => {
  if (
    !request.deliveries.some((delivery) => ['queued', 'paused', 'failed'].includes(delivery.status))
  )
    return null;
  const recovery = requestRecovery(request);
  return (
    <div className="chat-queued-actions flex gap-1">
      {editable ? (
        <Button
          className="chat-queued-edit"
          size="icon-xs"
          variant="ghost"
          aria-label="Edit queued message"
          title="Edit queued message"
          disabled={working}
          onClick={edit}
        >
          <Pencil size={13} />
        </Button>
      ) : null}
      {request.deliveries.some((delivery) =>
        ['queued', 'paused', 'failed'].includes(delivery.status),
      ) ? (
        <QueuedMessageMenu
          request={request}
          update={update}
          working={working}
          busy={busy}
          canMoveEarlier={canMoveEarlier}
          canMoveLater={canMoveLater}
          queuePaused={queuePaused}
          menuRecovery={canResume ? recovery : null}
        />
      ) : null}
    </div>
  );
};
