import { useNavigate } from '@tanstack/react-router';
import type { CommandPaletteProps } from '@/CommandPalette/types.ts';
import type { ChatThread } from '@/navigation.ts';
import { useManualUpdateCheck } from '@/AppUpdates/hooks/useManualUpdateCheck.ts';
import { useSidebar } from '@pitchcrew/design-system/sidebar';
import { requestNewNote, requestOpenNote } from '@/lib/new-note.ts';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

export const useCommandPalette = (props: CommandPaletteProps) => {
  const { toggleSidebar } = useSidebar();
  const navigate = useNavigate();
  const { openChat } = useWorkspaceNavigation();
  const checkUpdates = useManualUpdateCheck();
  const data = useWorkspaceStore((state) => state.data);
  const recentIds = useWorkspaceStore((state) => state.recentIds);
  const run = (fn: () => void) => () => {
    props.onOpenChange(false);
    fn();
  };
  const store = () => useWorkspaceStore.getState();
  return {
    ...props,
    conversations: data?.conversations ?? [],
    notes: data?.profile ?? [],
    recentIds,
    toggleSidebar,
    run,
    onOpenConversation: (id: string) => void openChat(id as ChatThread),
    onNewConversation: () => store().setCreatingConversation(true),
    onNewNote: () =>
      void navigate({ to: '/profile' }).then(() => {
        if (window.location.pathname === '/profile') requestNewNote();
      }),
    onOpenNote: (name: string, find = '') => {
      requestOpenNote(name, find);
      void navigate({ to: '/profile' });
    },
    onCheckUpdates: () => void checkUpdates(),
    onShowIntroduction: data?.onboarding
      ? () =>
          void store()
            .action('/onboarding', 'PUT', { version: 1, status: 'welcome', step: 0 })
            .catch(() => {})
      : undefined,
  };
};
