import { useIsMobile } from '@pitchcrew/design-system/use-mobile';
import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery.ts';
import type {
  MarkdownCursor,
  MarkdownEditorHandle,
  MarkdownMode,
} from '@/components/MarkdownEditor/types.ts';
import type { OutlineEntry } from '@/components/MarkdownEditor/helpers.ts';
import type { ProfileViewModel } from '../types.ts';
import {
  clampExplorerWidth,
  explorerBounds,
  railQuery,
  readLayout,
  overlayBelow,
  splitMinimum,
  wideQuery,
  writeLayout,
  type ProfileLayout,
} from '../layout.ts';

/** A note-level dialog: new note (in a folder), rename or delete one note. */
export type NoteDialog =
  | { kind: 'create'; folder: string }
  | { kind: 'rename'; name: string }
  | { kind: 'delete'; name: string };

/**
 * The editor frame around the note: explorer width and visibility, the citations rail, the
 * Write | Split | Preview mode and the editor handle. Desktop choices are remembered on this
 * device; on phones the note tree replaces the document until a note is chosen.
 */
export const useProfileWorkspace = (controller: ProfileViewModel) => {
  const mobile = useIsMobile();
  const railRoom = useMediaQuery(railQuery) && !mobile;
  const [layout, setLayout] = useState(() => readLayout(window.matchMedia(wideQuery).matches));
  // Phones start on the note list (the explorer replaces the document until a note is chosen).
  const [mobileExplorer, setMobileExplorer] = useState(true);
  const [cursor, setCursor] = useState<MarkdownCursor | null>(null);
  // The line at the top of the view while the reader scrolls; a caret move takes over again.
  const [viewLine, setViewLine] = useState<number | null>(null);
  const [dialog, setDialog] = useState<NoteDialog | null>(null);
  const editor = useRef<MarkdownEditorHandle | null>(null);
  const [limitHit, setLimitHit] = useState(0);
  const [sheetWidth, setSheetWidth] = useState(Infinity);
  const [workspaceWidth, setWorkspaceWidth] = useState(Infinity);
  // Too narrow for the explorer beside a readable note (a tablet beside the app sidebar): the
  // explorer opens as a drawer over the note instead, closed until asked for.
  const [overlayOpen, setOverlayOpen] = useState(false);
  useEffect(() => {
    if (!limitHit) return;
    const timer = window.setTimeout(() => setLimitHit(0), 6000);
    return () => window.clearTimeout(timer);
  }, [limitHit]);
  const update = (patch: Partial<ProfileLayout>) =>
    setLayout((current) => {
      const next = { ...current, ...patch };
      writeLayout(next);
      return next;
    });
  // Split needs two usable columns; a narrower sheet shows Write until it has room again.
  const splitRoom = !mobile && sheetWidth >= splitMinimum;
  const mode: MarkdownMode = !splitRoom && layout.mode === 'split' ? 'write' : layout.mode;
  // Decided with the explorer at its narrowest, so widening it never flips it into a drawer.
  const overlay =
    !mobile &&
    workspaceWidth - explorerBounds.min - (railRoom && layout.citationsOpen ? 264 : 0) <
      overlayBelow;
  const explorerVisible = mobile ? mobileExplorer : overlay ? overlayOpen : layout.explorerOpen;
  const focusToggle = () =>
    document.querySelector<HTMLElement>('.profile-explorer-toggle')?.focus();
  // Choosing a note from the drawer closes it and puts the caret in that note, or, in Preview
  // (no caret there), focus on the note's tab.
  const showNote = () => {
    setMobileExplorer(false);
    if (overlay && overlayOpen)
      requestAnimationFrame(() =>
        mode === 'preview'
          ? document
              .querySelector<HTMLElement>('.profile-document-tab[aria-selected="true"]')
              ?.focus()
          : editor.current?.focus(),
      );
    setOverlayOpen(false);
  };
  useEffect(() => {
    if (!overlay || !overlayOpen) return;
    // Escape anywhere in the drawer closes it, even in a search with text (which also clears).
    // Menus and dialogs opened from it sit outside the drawer and close themselves first.
    const close = (event: KeyboardEvent) => {
      const target = event.target as Element | null;
      if (event.key !== 'Escape') return;
      if (target !== document.body && !target?.closest('#profile-explorer')) return;
      setOverlayOpen(false);
      focusToggle();
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [overlay, overlayOpen]);
  // Crossing the drawer threshold carries the explorer over: an open drawer stays open as a
  // column (adjusted during render, React's pattern for state that follows a changed input).
  const [wasOverlay, setWasOverlay] = useState(overlay);
  if (wasOverlay !== overlay) {
    setWasOverlay(overlay);
    if (!overlay && overlayOpen) {
      setOverlayOpen(false);
      update({ explorerOpen: true });
    }
  }
  // Becoming a drawer hides the explorer: focus there moves to the note.
  useEffect(() => {
    if (overlay && document.activeElement?.closest('#profile-explorer'))
      requestAnimationFrame(() => editor.current?.focus());
  }, [overlay]);
  return {
    mobile,
    mode,
    splitRoom,
    setSheetWidth,
    overlay,
    setWorkspaceWidth,
    closeOverlay: () => {
      setOverlayOpen(false);
      focusToggle();
    },
    setMode: (next: MarkdownMode) => update({ mode: next }),
    showSyntax: layout.showSyntax,
    setShowSyntax: (showSyntax: boolean) => update({ showSyntax }),
    editor,
    cursor,
    setCursor: (next: MarkdownCursor) => {
      setCursor(next);
      setViewLine(null);
    },
    viewLine,
    setViewLine,
    dialog,
    setDialog,
    /** An edit was refused at the note limit; the status bar says so for a few seconds. */
    limitHit: limitHit > 0,
    flagLimit: () => setLimitHit(Date.now()),
    showNote,
    explorerVisible,
    explorerWidth: layout.explorerWidth,
    /** Drags resize in memory; the width is stored once the drag ends. */
    resizeExplorer: (width: number, commit = true) => {
      const explorerWidth = clampExplorerWidth(width);
      if (commit) update({ explorerWidth });
      else setLayout((current) => ({ ...current, explorerWidth }));
    },
    toggleExplorer: () => {
      if (mobile) return setMobileExplorer((open) => !open);
      if (!overlay) return update({ explorerOpen: !layout.explorerOpen });
      setOverlayOpen(!overlayOpen);
      // A drawer takes focus, like the phone's: its search field first.
      if (!overlayOpen)
        requestAnimationFrame(() =>
          document.querySelector<HTMLElement>('#profile-explorer input')?.focus(),
        );
    },
    railRoom,
    citationsOpen: layout.citationsOpen,
    toggleCitations: () => update({ citationsOpen: !layout.citationsOpen }),
    /** Opens a note; a search term moves the editor to its first match, like a search hit. */
    openNote: (note: { name: string; content: string }, find = '') => {
      controller.openNote(note);
      showNote();
      if (!find) return;
      if (mode === 'preview') update({ mode: 'write' });
      requestAnimationFrame(() =>
        requestAnimationFrame(() => editor.current?.revealText(find, { ignoreCase: true })),
      );
    },
    /** Find in a note from any mode: Preview switches to Write, where find works. */
    find: () => {
      if (mode === 'preview') update({ mode: 'write' });
      requestAnimationFrame(() => editor.current?.openSearch());
    },
    selectNote: (id: string) => {
      controller.selectNote(id);
      showNote();
    },
    /** Asks for a title first; the note opens once it has one. */
    createNote: (folder = '') => setDialog({ kind: 'create', folder }),
    finishCreate: async (title: string, folder: string) => {
      const opened = await controller.createNote(title, folder);
      if (!opened) return false;
      setDialog(null);
      showNote();
      if (mode === 'preview') update({ mode: 'write' });
      requestAnimationFrame(() => editor.current?.focus('end'));
      return true;
    },
    /** Selects the quoted line in the editor so it scrolls into view. */
    revealQuote: (quote: string) => {
      if (mode === 'preview') update({ mode: 'write' });
      requestAnimationFrame(() => editor.current?.revealText(quote));
    },
    /** Moves to a heading: in the editor, or in the rendered preview when only it is shown. */
    revealHeading: (entry: OutlineEntry, index: number) => {
      if (mode !== 'preview') return editor.current?.revealLine(entry.line);
      document
        .querySelectorAll<HTMLElement>('.profile-sheet .md-preview :is(h1,h2,h3,h4,h5,h6)')
        [index]?.scrollIntoView({
          block: 'start',
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
    },
  };
};
