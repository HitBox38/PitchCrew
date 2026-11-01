import { useNavigate } from '@tanstack/react-router';
import { useSidebar } from '@pitchcrew/design-system/sidebar';
import { requestNewNote } from '@/lib/new-note.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

/**
 * New job, conversation or Profile note through the existing actions, shared by the sidebar's
 * + menu and the phone top bar's overflow. Each closes the phone drawer first.
 */
export const useNewActions = (onAddJob: () => void) => {
  const navigate = useNavigate();
  const { setOpenMobile } = useSidebar();
  const setCreatingConversation = useWorkspaceStore((store) => store.setCreatingConversation);
  return {
    addJob: () => {
      setOpenMobile(false);
      onAddJob();
    },
    newConversation: () => {
      setOpenMobile(false);
      setCreatingConversation(true);
    },
    newNote: async () => {
      setOpenMobile(false);
      await navigate({ to: '/profile' });
      // A blocked navigation (unsaved changes kept) must not leave a note request behind.
      if (window.location.pathname === '/profile') requestNewNote();
    },
  };
};
