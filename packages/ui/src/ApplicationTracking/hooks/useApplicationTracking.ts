import { useDirtyNotification } from '@/hooks/useDirtyNotification.ts';
import { useState } from 'react';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { Card } from '@pitchcrew/core';

export const useApplicationTracking = (card: Card, onDirtyChange?: (dirty: boolean) => void) => {
  const data = useWorkspaceStore((state) => state.data);
  const act = useWorkspaceStore((state) => state.act);
  const action = useWorkspaceStore((state) => state.action);
  const working = useWorkspaceStore((state) => state.working);
  const [threadId, setThreadId] = useState('');
  const [identifierDirty, setIdentifierDirty] = useState(false);
  useDirtyNotification(identifierDirty || Boolean(threadId.trim()), onDirtyChange);
  const path = `/tracking/applications/${card.id}/thread`;
  return {
    working,
    threadId,
    setThreadId,
    setIdentifierDirty,
    signals:
      data?.trackingSignals
        ?.filter((signal) => signal.cardId === card.id || signal.candidateIds.includes(card.id))
        .slice(-10) ?? [],
    connected: data?.connectors.some(
      (connector) =>
        connector.id === 'google' && connector.connected && connector.services.includes('gmail'),
    ),
    unlink: (link: { account: string; threadId: string }) =>
      act(path, 'DELETE', link, 'Email thread unlinked'),
    link: () => {
      void action(path, 'POST', { threadId }, 'Email thread linked')
        .then(() => setThreadId(''))
        .catch(() => {});
    },
  };
};
