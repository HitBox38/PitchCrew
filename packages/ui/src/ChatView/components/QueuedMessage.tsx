import { QueuedMessageActions } from './QueuedMessageActions.tsx';
import { RequestDeliveryStatus } from './RequestDeliveryStatus.tsx';
import { useState } from 'react';
import type { ChatRequest, Snapshot } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';
import { Input } from '@/components/ui/input/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
export function QueuedMessage({
  request,
  data,
  action,
  working,
}: {
  request: ChatRequest;
  data: Snapshot;
  action: Action;
  working: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(request.content);
  const update = (command: string, extra = {}) =>
    action(`/chat-requests/${request.id}`, 'PUT', { action: command, ...extra }).catch(() => {});
  const editable =
    !request.userInputId &&
    request.deliveries.every(
      (delivery) => !delivery.runId && ['queued', 'paused'].includes(delivery.status),
    );
  return (
    <div className="chat-queued-message">
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void update('edit', { content }).then(() => setEditing(false));
            }}
          >
            <Input
              aria-label="Edit queued message"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={8000}
            />
            <Button type="submit" size="xs" disabled={working}>
              Save
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>
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
        <RequestDeliveryStatus request={request} data={data} />
      </div>
      {!editing ? (
        <QueuedMessageActions
          request={request}
          editable={editable}
          working={working}
          update={update}
          edit={() => setEditing(true)}
        />
      ) : null}
    </div>
  );
}
