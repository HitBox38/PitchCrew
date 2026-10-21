import { QueuedMessageActions } from './QueuedMessageActions.tsx';
import { RequestDeliveryStatus } from './RequestDeliveryStatus.tsx';
import { useQueuedMessage } from '../hooks/useQueuedMessage.ts';
import type { ChatRequest, Snapshot } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';
import { Input } from '@/components/ui/input/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
export const QueuedMessage = ({
  request,
  data,
  action,
  working,
}: {
  request: ChatRequest;
  data: Snapshot;
  action: Action;
  working: boolean;
}) => {
  const { editing, setEditing, content, setContent, error, update, save } = useQueuedMessage(
    request,
    action,
  );
  const editable =
    !request.userInputId &&
    request.deliveries.every(
      (delivery) => !delivery.runId && ['queued', 'paused', 'failed'].includes(delivery.status),
    );
  return (
    <div className="chat-queued-message">
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <Input
              className="min-w-0 flex-1 basis-40"
              aria-label="Edit queued message"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={8000}
            />
            <Button type="submit" size="sm" disabled={working}>
              Save
            </Button>
            <Button
              className="text-button"
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <p>
            {request.userInputId
              ? `Continue ${data.roles.find((role) => role.id === request.deliveries[0]?.roleId)?.name ?? 'the agent'} after your answer`
              : request.summarize
                ? 'Summarizing before continuing…'
                : request.content || `${request.attachments.length} attached files`}
          </p>
        )}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <RequestDeliveryStatus request={request} data={data} />
      </div>
      {!editing ? (
        <QueuedMessageActions
          request={request}
          editable={editable}
          working={working}
          update={update}
          edit={() => {
            setContent(null);
            setEditing(true);
          }}
        />
      ) : null}
    </div>
  );
};
