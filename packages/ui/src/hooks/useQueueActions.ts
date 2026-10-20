import type { WorkQueueView } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';

export const useQueueActions = (queue: WorkQueueView, answerThreadId?: string) => {
  const action = useWorkspaceStore((state) => state.action);
  const openCard = useWorkspaceStore((state) => state.openCard);
  const working = useWorkspaceStore((state) => state.working);
  const navigation = useWorkspaceNavigation();
  const command = (kind: 'pause' | 'resume' | 'stop') =>
    void action(`/queue/${encodeURIComponent(queue.id)}`, 'PUT', { action: kind }).catch(() => {});
  const open = () => {
    if (queue.cardId && queue.state !== 'waiting') openCard(queue.cardId);
    else void navigation.openChat(answerThreadId ?? queue.threadId);
  };
  const resumeBlocked = queue.paused && queue.pauseKind !== undefined && queue.pauseKind !== 'user';
  return { open, command, working, resumeBlocked };
};
