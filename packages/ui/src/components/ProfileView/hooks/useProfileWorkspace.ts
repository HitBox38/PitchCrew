import { useIsMobile } from '@pitchcrew/design-system/use-mobile';
import { useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery.ts';
import type { ProfileViewModel } from '../types.ts';
import {
  clampExplorerWidth,
  railQuery,
  readLayout,
  selectQuote,
  wideQuery,
  writeLayout,
  type ProfileLayout,
} from '../layout.ts';

/**
 * The editor frame around the note: the explorer's width and visibility, the citations rail and
 * the Write | Preview mode. Desktop choices are remembered on this device; on phones the note
 * tree replaces the document until a note is chosen.
 */
export const useProfileWorkspace = (controller: ProfileViewModel) => {
  const mobile = useIsMobile();
  const railRoom = useMediaQuery(railQuery) && !mobile;
  const [layout, setLayout] = useState(() => readLayout(window.matchMedia(wideQuery).matches));
  const [mobileExplorer, setMobileExplorer] = useState(true);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const update = (patch: Partial<ProfileLayout>) =>
    setLayout((current) => {
      const next = { ...current, ...patch };
      writeLayout(next);
      return next;
    });
  const explorerVisible = mobile ? mobileExplorer : layout.explorerOpen;
  const showNote = () => {
    setMobileExplorer(false);
  };
  return {
    mobile,
    mode,
    setMode,
    showNote,
    explorerVisible,
    explorerWidth: layout.explorerWidth,
    resizeExplorer: (width: number) => update({ explorerWidth: clampExplorerWidth(width) }),
    toggleExplorer: () =>
      mobile ? setMobileExplorer((open) => !open) : update({ explorerOpen: !layout.explorerOpen }),
    railRoom,
    citationsOpen: layout.citationsOpen,
    toggleCitations: () => update({ citationsOpen: !layout.citationsOpen }),
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
    /** Switches to Write and selects the quoted line so the editor scrolls to it. */
    revealQuote: (quote: string) => {
      setMode('write');
      requestAnimationFrame(() => {
        const editor = document.getElementById('profile-content');
        if (editor instanceof HTMLTextAreaElement) selectQuote(editor, quote);
      });
    },
  };
};
