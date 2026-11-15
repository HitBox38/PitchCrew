import { deliveryLifecycle } from '@pitchcrew/core/lifecycles';
import { useEffect, useRef, useState } from 'react';
import type { ChatRequest } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { QueueMoves } from '../types.ts';

export const useQueueRequest = (request: ChatRequest, queueId: string, moves: QueueMoves) => {
  const [editing, setEditing] = useState(false);
  const actionsRef = useRef<HTMLButtonElement | null>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (!editing && wasEditing.current) actionsRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);
  const action = useWorkspaceStore((state) => state.action);
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
    void action(`/chat-requests/${request.id}`, 'PUT', { action: kind }).catch(() => {});
  const skip = async () => {
    try {
      await action(`/chat-requests/${request.id}`, 'PUT', { action: 'remove' });
      await action(`/queue/${encodeURIComponent(queueId)}`, 'PUT', { action: 'resume' });
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
