import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useNavigate } from '@tanstack/react-router';
import type { ChatThread, View } from './navigation.ts';
import { viewPaths } from './navigation.ts';
import type { Conversation } from '@pitchcrew/core';

export const useWorkspaceNavigation = () => {
  const navigate = useNavigate();
  return {
    go: (view: View) => {
      void navigate({ to: viewPaths[view] });
      useWorkspaceStore.getState().setSelectedId(null);
    },
    openChat: async (thread: ChatThread) => {
      const state = useWorkspaceStore.getState();
      const role = state.data?.roles.find((item) => item.id === thread);
      if (
        role &&
        state.data?.conversations &&
        !state.data.conversations.some((item) => item.id === thread)
      ) {
        if (state.working) return;
        try {
          const existing = state.data.conversations.find(
            (item) =>
              item.kind === 'direct' &&
              item.participants.length === 1 &&
              item.participants[0] === thread &&
              !item.archived,
          );
          const next =
            existing ??
            ((await state.action('/conversations', 'POST', {
              title: `${role.name} chat`,
              participants: [thread],
            })) as Conversation);
          thread = next.id;
        } catch {
          // The workspace action displays the error.
          return;
        }
      }
      await navigate({ to: '/chat/$thread', params: { thread } });
      state.setSelectedId(null);
    },
  };
};
