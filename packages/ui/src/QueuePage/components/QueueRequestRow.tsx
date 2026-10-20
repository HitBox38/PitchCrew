import { boardActionLabels } from '@pitchcrew/core/states';
import { useState, type ReactNode } from 'react';
import { type ChatRequest } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/index.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { EditQueueMessage } from './EditQueueMessage.tsx';

export function QueueRequestRow({
  request,
  handle,
  queueId,
}: {
  request: ChatRequest;
  handle: ReactNode;
  queueId: string;
}) {
  const [editing, setEditing] = useState(false);
  const action = useWorkspaceStore((s) => s.action);
  const working = useWorkspaceStore((s) => s.working);
  const pending = request.deliveries.some((d) => ['queued', 'paused', 'failed'].includes(d.status));
  const failed = request.deliveries.some((d) => ['paused', 'failed'].includes(d.status));
  const command = (kind: string) =>
    void action(`/chat-requests/${request.id}`, 'PUT', { action: kind }).catch(() => {});
  const skip = async () => {
    try {
      await action(`/chat-requests/${request.id}`, 'PUT', { action: 'remove' });
      await action(`/queue/${encodeURIComponent(queueId)}`, 'PUT', { action: 'resume' });
    } catch {
      /* Displayed by the workspace. */
    }
  };
  return (
    <div className="queue-request">
      {handle}
      <div className="min-w-0 flex-1">
        {editing ? (
          <EditQueueMessage request={request} close={() => setEditing(false)} />
        ) : (
          <>
            <p className="line-clamp-3 whitespace-pre-wrap" title={request.content}>
              {request.boardAction ? boardActionLabels[request.boardAction] : request.content}
            </p>
            <p className="quiet text-xs">
              {request.routine ? 'Scheduled routine · ' : ''}
              {request.deliveries.map((d) => `${d.roleId}: ${d.status}`).join(', ')}
            </p>
            {request.deliveries.find((d) => d.error)?.error ? (
              <p className="form-error text-sm">{request.deliveries.find((d) => d.error)?.error}</p>
            ) : null}
          </>
        )}
      </div>
      {pending && !editing ? (
        <div className="queue-row-actions">
          {failed ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={working}
                onClick={() => command('resume')}
              >
                Retry
              </Button>
              <Button variant="ghost" size="sm" disabled={working} onClick={() => void skip()}>
                Skip and continue
              </Button>
            </>
          ) : (
            <>
              {!request.boardAction &&
              !request.routine &&
              !request.deliveries.some((d) => d.runId) ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={working}
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                disabled={working}
                onClick={() => command('remove')}
              >
                Remove
              </Button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
