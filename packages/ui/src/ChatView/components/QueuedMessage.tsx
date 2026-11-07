import { QueuedMessageActions } from './QueuedMessageActions.tsx';
import { RequestDeliveryStatus } from './RequestDeliveryStatus.tsx';
import { useQueuedMessage } from '../hooks/useQueuedMessage.ts';
import type { ChatRequest, Snapshot } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';
import { QueuedMessageText } from './QueuedMessageText.tsx';
import { canEditQueuedMessage, hasMixedDeliveryState } from '../queue-presentation.ts';
import { QueuedMessageProblem } from './QueuedMessageProblem.tsx';
import { queueRowState } from '../queue-row-state.ts';
export const QueuedMessage = ({
  request,
  data,
  action,
  working,
  onEdit,
  canMoveEarlier,
  canMoveLater,
}: {
  request: ChatRequest;
  data: Snapshot;
  action: Action;
  working: boolean;
  onEdit: (request: ChatRequest) => void;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
}) => {
  const editor = useQueuedMessage(request, action);
  const { queuePaused, canResume, reordering, busy, occupying } = queueRowState(request, data);
  const editable = canEditQueuedMessage(request);
  const text = request.userInputId
    ? `Continue ${data.roles.find((role) => role.id === request.deliveries[0]?.roleId)?.name ?? 'the agent'} after your answer`
    : request.summarize
      ? 'Summarizing before continuing…'
      : request.content || `${request.attachments.length} attached files`;
  return (
    <div className="chat-queued-message">
      <div className="chat-queued-content min-w-0">
        <QueuedMessageText request={request} text={text} />
        {editor.error && !editor.editing ? <QueuedMessageProblem error={editor.error} /> : null}
        {hasMixedDeliveryState(request) ||
        occupying ||
        request.deliveries.some(
          (delivery) => ['failed', 'paused'].includes(delivery.status) && !!delivery.runId,
        ) ? (
          <RequestDeliveryStatus request={request} data={data} />
        ) : null}
      </div>
      <QueuedMessageActions
        request={request}
        editable={editable}
        working={working}
        busy={busy}
        update={editor.update}
        edit={() => onEdit(request)}
        canMoveEarlier={canMoveEarlier && reordering}
        canMoveLater={canMoveLater && reordering}
        queuePaused={queuePaused}
        canResume={canResume}
      />
    </div>
  );
};
