import { useMemo } from 'react';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { collectNotifications } from '../helpers.ts';
import { useNotificationStore } from '../store.ts';
import { remoteConnectionNotifications } from '../remote-connections.ts';

export const useNotificationItems = () => {
  const data = useWorkspaceStore((s) => s.data);
  const remoteRequests = useNotificationStore((state) => state.remoteRequests);
  const items = useMemo(
    () =>
      [
        ...(data ? collectNotifications(data) : []),
        ...remoteConnectionNotifications(remoteRequests),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)),
    [data, remoteRequests],
  );
  const read = useNotificationStore((s) => s.read);
  const unread = useMemo(() => {
    const readIds = new Set(read);
    return items.filter((item) => !readIds.has(item.id));
  }, [items, read]);
  return { data, items, read, unread };
};
