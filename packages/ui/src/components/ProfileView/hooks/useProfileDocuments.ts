import { useState } from 'react';
import type { ProfileDocumentsState, ProfileViewProps } from '../types.ts';
import {
  closeDocument,
  discardDocuments,
  documentDirty,
  initialProfileNote,
  openDocument,
  syncDocuments,
} from '../helpers.ts';

export function useProfileDocuments(data: ProfileViewProps['data']) {
  const [state, setState] = useState<ProfileDocumentsState>(() => {
    const note = data.profile[0] ?? initialProfileNote;
    return openDocument({ documents: [], activeId: null }, note, crypto.randomUUID());
  });
  const active = state.documents.find((document) => document.id === state.activeId);
  const update = (id: string, patch: Partial<Omit<(typeof state.documents)[number], 'id'>>) =>
    setState((state) => ({
      ...state,
      documents: state.documents.map((document) =>
        document.id === id ? { ...document, ...patch } : document,
      ),
    }));
  const [notes, setNotes] = useState(data.profile);
  if (notes !== data.profile) {
    setNotes(data.profile);
    setState((state) => syncDocuments(state, data.profile));
  }
  return {
    ...state,
    active,
    dirty: state.documents.some(documentDirty),
    update,
    select: (id: string) => setState((state) => ({ ...state, activeId: id })),
    open: (note: { name: string; content: string }, replace = false) => {
      const id = crypto.randomUUID();
      setState((state) => openDocument(state, note, id, replace));
    },
    close: (id: string) => setState((state) => closeDocument(state, id)),
    discard: () => setState(discardDocuments),
  };
}
