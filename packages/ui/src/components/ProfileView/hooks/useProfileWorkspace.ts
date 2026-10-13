import { useIsMobile } from '@/hooks/use-mobile.ts';
import { useState } from 'react';
import type { ProfileViewModel } from '../types.ts';

export function useProfileWorkspace(controller: ProfileViewModel) {
  const mobile = useIsMobile();
  const [desktopExplorer, setDesktopExplorer] = useState(true);
  const [mobileExplorer, setMobileExplorer] = useState(false);
  const explorerVisible = mobile ? mobileExplorer : desktopExplorer;
  const showNote = () => {
    setMobileExplorer(false);
  };
  return {
    explorerVisible,
    toggleExplorer: () =>
      mobile ? setMobileExplorer((open) => !open) : setDesktopExplorer((open) => !open),
    openNote: (note: { name: string; content: string }) => {
      controller.openNote(note);
      showNote();
    },
    selectNote: (id: string) => {
      controller.selectNote(id);
      showNote();
    },
    createNote: async (folder?: string) => {
      const opened = await controller.createNote(folder);
      if (opened) showNote();
      return opened;
    },
  };
}
