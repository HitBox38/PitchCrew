import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ProfileDocument, ProfileDocumentsState, ProfileViewProps } from '../types.ts';
import {
  closeDocument,
  discardDocuments,
  documentDirty,
  openDocument,
  renameDocument,
  reorderDocument,
  resolveConflict,
  syncDocuments,
} from '../documents.ts';
import { readSession, restoreSession, writeSession } from '../session.ts';

type Patch = Partial<Omit<ProfileDocument, 'id'>>;

/** Open note tabs: drafts, saved copies and disk reconciliation, restored per device. */
export const useProfileDocuments = (data: ProfileViewProps['data']) => {
  const [state, setState] = useState<ProfileDocumentsState>(() =>
    restoreSession(data.profile, readSession(), () => crypto.randomUUID()),
  );
  const ref = useRef(state);
  useLayoutEffect(() => {
    ref.current = state;
  });
  const [notes, setNotes] = useState(data.profile);
  if (notes !== data.profile) {
    setNotes(data.profile);
    setState((current) => syncDocuments(current, data.profile));
  }
  const names = state.documents.map((document) => document.saved.name).join('\n');
  const activeName = state.documents.find((document) => document.id === state.activeId)?.saved.name;
  useEffect(() => {
    writeSession({ open: names ? names.split('\n') : [], active: activeName ?? null });
  }, [names, activeName]);
  const update = (id: string, patch: Patch | ((document: ProfileDocument) => Patch)) =>
    setState((current) => ({
      ...current,
      documents: current.documents.map((document) =>
        document.id === id
          ? { ...document, ...(typeof patch === 'function' ? patch(document) : patch) }
          : document,
      ),
    }));
  const active = state.documents.find((document) => document.id === state.activeId);
  return {
    ...state,
    /** Latest state for async work that must not act on a stale render. */
    ref,
    active,
    dirty: state.documents.some(documentDirty),
    update,
    select: (id: string) => setState((current) => ({ ...current, activeId: id })),
    open: (note: { name: string; content: string }, options?: Parameters<typeof openDocument>[3]) =>
      setState((current) => openDocument(current, note, crypto.randomUUID(), options)),
    rename: (from: string, to: string) => setState((current) => renameDocument(current, from, to)),
    close: (id: string) => setState((current) => closeDocument(current, id)),
    closeMany: (ids: string[]) =>
      setState((current) => ids.reduce((next, id) => closeDocument(next, id), current)),
    discard: () => setState(discardDocuments),
    reorder: (id: string, index: number) =>
      setState((current) => reorderDocument(current, id, index)),
    resolve: (id: string, keep: 'disk' | 'mine') =>
      setState((current) => {
        const document = current.documents.find((entry) => entry.id === id);
        if (!document) return current;
        const next = resolveConflict(document, keep);
        if (!next) return closeDocument(current, id);
        return {
          ...current,
          documents: current.documents.map((entry) => (entry.id === id ? next : entry)),
        };
      }),
  };
};
