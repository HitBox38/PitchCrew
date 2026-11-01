import { useIsMobile } from '@pitchcrew/design-system/use-mobile';
import { useState } from 'react';
import type { ProfileViewModel } from '../types.ts';

/** On phones the note tree replaces the document until a note is chosen. */
export const useProfileWorkspace = (controller: ProfileViewModel) => {
  const mobile = useIsMobile();
  const [desktopExplorer, setDesktopExplorer] = useState(true);
  const [mobileExplorer, setMobileExplorer] = useState(true);
  const explorerVisible = mobile ? mobileExplorer : desktopExplorer;
  const showNote = () => {
    setMobileExplorer(false);
  };
  return {
    mobile,
    showNote,
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
};
