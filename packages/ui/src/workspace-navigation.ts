import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useNavigate } from '@tanstack/react-router';
import type { ChatThread, View } from './navigation.ts';
import { viewPaths } from './navigation.ts';

export function useWorkspaceNavigation() {
  const navigate = useNavigate();
  return {
    go: (view: View) => {
      void navigate({ to: viewPaths[view] });
      useWorkspaceStore.getState().setSelectedId(null);
    },
    openChat: (thread: ChatThread) => {
      void navigate({ to: '/chat/$thread', params: { thread } });
      useWorkspaceStore.getState().setSelectedId(null);
    },
  };
}
