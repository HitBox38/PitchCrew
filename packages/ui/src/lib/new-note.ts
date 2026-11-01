import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * A request, from anywhere in the shell (command palette, the sidebar's New menu), for Profile to
 * start a new note. Callers navigate to /profile and call `requestNewNote`; the mounted Profile
 * page consumes the request once through `useNewNoteRequest`.
 */
const useNewNoteStore = create<{ pending: number; request: () => void; take: () => boolean }>(
  (set, get) => ({
    pending: 0,
    request: () => set({ pending: get().pending + 1 }),
    take: () => {
      if (!get().pending) return false;
      set({ pending: 0 });
      return true;
    },
  }),
);

export const requestNewNote = () => useNewNoteStore.getState().request();

/** Profile calls this with its own note creation; a pending request runs once. */
export const useNewNoteRequest = (createNote: () => unknown) => {
  const pending = useNewNoteStore((state) => state.pending);
  useEffect(() => {
    if (pending && useNewNoteStore.getState().take()) void createNote();
  }, [pending, createNote]);
};
