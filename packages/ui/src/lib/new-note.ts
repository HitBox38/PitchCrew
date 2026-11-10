import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Requests, from anywhere in the shell (command palette, the sidebar's New menu), for Profile to
 * start a new note or open an existing one. Callers navigate to /profile and call
 * `requestNewNote` or `requestOpenNote`; the mounted Profile page consumes each request once.
 */
const useNoteRequests = create<{
  pending: number;
  open: { name: string; find: string } | null;
  request: () => void;
  take: () => boolean;
}>((set, get) => ({
  pending: 0,
  open: null,
  request: () => set({ pending: get().pending + 1 }),
  take: () => {
    if (!get().pending) return false;
    set({ pending: 0 });
    return true;
  },
}));

export const requestNewNote = () => useNoteRequests.getState().request();
/** Opens a note on Profile; `find` (a search the user typed) moves the editor to its match. */
export const requestOpenNote = (name: string, find = '') =>
  useNoteRequests.setState({ open: { name, find } });

/** Profile calls this with its own note creation; a pending request runs once. */
export const useNewNoteRequest = (createNote: () => unknown) => {
  const pending = useNoteRequests((state) => state.pending);
  useEffect(() => {
    if (pending && useNoteRequests.getState().take()) void createNote();
  }, [pending, createNote]);
};

/** Profile calls this to open a note the palette chose; the request runs once. */
export const useOpenNoteRequest = (openNote: (name: string, find: string) => void) => {
  const open = useNoteRequests((state) => state.open);
  useEffect(() => {
    if (!open) return;
    useNoteRequests.setState({ open: null });
    openNote(open.name, open.find);
  }, [open, openNote]);
};
