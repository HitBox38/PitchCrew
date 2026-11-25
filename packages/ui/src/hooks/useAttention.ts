import { cachedAttention, type AttentionItem } from '@/lib/attention.ts';
import { useNotificationStore } from '@/Notifications/store.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

const none: readonly AttentionItem[] = [];

/**
 * Every attention item, ranked, for the shell's Home badge and Home itself. One result is shared
 * across callers and recomputed only when a snapshot slice it reads changes. Remote connection
 * requests come from the notification center's single `/api/remote-mcp` reader; never fetch them
 * again here.
 */
export const useAttention = (): readonly AttentionItem[] => {
  const data = useWorkspaceStore((state) => state.data);
  const remoteRequests = useNotificationStore((state) => state.remoteRequests);
  return data ? cachedAttention(data, remoteRequests) : none;
};
