import type { WorkQueueView } from '@pitchcrew/core';
import { useWorkspaceStore, type Action } from '@/WorkspaceStore/index.ts';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';

/**
 * A queue's Pause, Resume and Stop, and where it opens. `action` sends the commands (default: the
 * workspace's), so a host can act through its own wrapper, as Home does, without changing what is
 * sent.
 */
export const useQueueActions = (queue: WorkQueueView, answerThreadId?: string, action?: Action) => {
  const workspaceAction = useWorkspaceStore((state) => state.action);
  const send = action ?? workspaceAction;
  const openCard = useWorkspaceStore((state) => state.openCard);
  const working = useWorkspaceStore((state) => state.working);
  const navigation = useWorkspaceNavigation();
  const command = (kind: 'pause' | 'resume' | 'stop') =>
    void send(`/queue/${encodeURIComponent(queue.id)}`, 'PUT', { action: kind }).catch(() => {});
  const open = () => {
    if (queue.cardId && queue.state !== 'waiting') openCard(queue.cardId);
    else void navigation.openChat(answerThreadId ?? queue.threadId);
  };
  const resumeBlocked = queue.paused && queue.pauseKind !== undefined && queue.pauseKind !== 'user';
  return { open, command, working, resumeBlocked };
};
