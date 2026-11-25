import { deliveryLifecycle } from '@pitchcrew/core/lifecycles';
import { useEffect, useRef, useState } from 'react';
import type { ChatRequest } from '@pitchcrew/core';
import { useWorkspaceStore, type Action } from '@/WorkspaceStore/index.ts';
import type { QueueMoves } from '../types.ts';

/**
 * One queued request's state and commands. `action` sends them (default: the workspace's), so a
 * host can decide through its own wrapper, as Home does, without changing what is sent.
 */
export const useQueueRequest = (
  request: ChatRequest,
  queueId: string,
  moves: QueueMoves,
  action?: Action,
) => {
  const [editing, setEditing] = useState(false);
  const actionsRef = useRef<HTMLButtonElement | null>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (!editing && wasEditing.current) actionsRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);
  const workspaceAction = useWorkspaceStore((state) => state.action);
  const send = action ?? workspaceAction;
  const working = useWorkspaceStore((state) => state.working);
  const pending = request.deliveries.some((delivery) =>
    deliveryLifecycle.is('unsent', delivery.status),
  );
  const failed = request.deliveries.some((delivery) =>
    deliveryLifecycle.is('stopped', delivery.status),
  );
  const editable =
    !request.boardAction &&
    !request.routine &&
    !request.deliveries.some((delivery) => delivery.runId);
  const command = (kind: 'resume' | 'remove') =>
    void send(`/chat-requests/${request.id}`, 'PUT', { action: kind }).catch(() => {});
  const skip = async () => {
    try {
      await send(`/chat-requests/${request.id}`, 'PUT', { action: 'remove' });
      await send(`/queue/${encodeURIComponent(queueId)}`, 'PUT', { action: 'resume' });
    } catch {
      /* Displayed by the workspace. */
    }
  };
  return {
    editing,
    setEditing,
    actionsRef,
    working,
    pending,
    failed,
    editable,
    command,
    skip,
    moves,
  };
};
