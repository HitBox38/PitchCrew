import { useMemo } from 'react';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { collectNotifications } from '../helpers.ts';
import { useNotificationStore } from '../store.ts';

export const useNotificationItems = () => {
  const data = useWorkspaceStore((s) => s.data);
  const items = useMemo(() => (data ? collectNotifications(data) : []), [data]);
  const read = useNotificationStore((s) => s.read);
  const unread = useMemo(() => {
    const readIds = new Set(read);
    return items.filter((item) => !readIds.has(item.id));
  }, [items, read]);
  return { data, items, read, unread };
};
