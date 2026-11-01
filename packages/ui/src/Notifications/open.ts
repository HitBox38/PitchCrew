import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useNotificationStore } from './store.ts';
import { workspaceToasts } from './toasts.ts';
import type { CrewNotification } from './types.ts';

/** Following a notice marks only that notice read and clears its toast and any side panel. */
export const openNotification = (item: Pick<CrewNotification, 'id' | 'target'>) => {
  useNotificationStore.getState().markRead([item.id]);
  workspaceToasts.close(item.id);
  useWorkspaceStore.getState().closePanels();
};
