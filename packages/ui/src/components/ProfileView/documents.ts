import type { ProfileDocument, ProfileDocumentsState } from './types.ts';

interface Note {
  name: string;
  content: string;
}

/** Unsaved: edited, renamed, or not on disk yet. */
export const documentDirty = (document: ProfileDocument) =>
  !document.persisted ||
  document.name !== document.saved.name ||
  document.content !== document.saved.content;

/**
 * A tab holding exactly a copy from disk. `revision` changes whenever a disk copy replaces the
 * text, so the editor starts a new undo history: undo can never bring back a discarded draft.
 */
const fresh = (id: string, note: Note, persisted: boolean, revision = 0): ProfileDocument => ({
  id,
  revision,
  ...note,
  saved: note,
  persisted,
  error: '',
  conflict: null,
  saving: null,
});

/** Opens a note in a new tab, or selects its existing tab; `replace` adopts a newer saved copy. */
export const openDocument = (
  state: ProfileDocumentsState,
  note: Note,
  id: string,
  { replace = false, persisted = true }: { replace?: boolean; persisted?: boolean } = {},
): ProfileDocumentsState => {
  const existing = state.documents.find((document) => document.saved.name === note.name);
  if (existing)
    return {
      activeId: existing.id,
      documents: replace
        ? state.documents.map((document) =>
            document.id === existing.id
              ? fresh(document.id, note, persisted, document.revision + 1)
              : document,
          )
        : state.documents,
    };
  return { activeId: id, documents: [...state.documents, fresh(id, note, persisted)] };
};

export const closeDocument = (state: ProfileDocumentsState, id: string): ProfileDocumentsState => {
  const index = state.documents.findIndex((document) => document.id === id);
  if (index < 0) return state;
  const documents = state.documents.filter((document) => document.id !== id);
  return {
    documents,
    activeId:
      state.activeId === id
        ? (documents[Math.min(index, documents.length - 1)]?.id ?? null)
        : state.activeId,
  };
};

/** Confirmed navigation: every draft returns to its saved copy; unsaved new notes close. */
export const discardDocuments = (state: ProfileDocumentsState): ProfileDocumentsState => {
  const documents = state.documents
    .filter((document) => document.persisted)
    .map((document) =>
      documentDirty(document)
        ? {
            ...document,
            ...document.saved,
            error: '',
            conflict: null,
            revision: document.revision + 1,
          }
        : document,
    );
  return {
    documents,
    activeId: documents.some((document) => document.id === state.activeId)
      ? state.activeId
      : (documents[0]?.id ?? null),
  };
};

/**
 * Reconciles open tabs with the notes on disk. Clean tabs follow disk; a draft whose saved copy
 * changed (or disappeared) underneath it keeps the draft and records the conflict for the user.
 */
export const syncDocuments = (
  state: ProfileDocumentsState,
  notes: Note[],
): ProfileDocumentsState => {
  let changed = false;
  const documents: ProfileDocument[] = [];
  for (const document of state.documents) {
    const disk = notes.find((note) => note.name === document.saved.name);
    const current = disk?.content ?? null;
    const before = document.persisted ? document.saved.content : null;
    // While a save is in flight, only its own echo (or the copy it is replacing) is expected;
    // anything else on disk is a real outside change.
    const settled = current === before || (document.saving !== null && current === document.saving);
    if (settled || document.conflict?.current === current) {
      documents.push(document);
      continue;
    }
    changed = true;
    if (!documentDirty(document)) {
      if (disk) documents.push(fresh(document.id, disk, true, document.revision + 1));
      continue;
    }
    if (current === document.content)
      documents.push({ ...document, saved: disk!, persisted: true, conflict: null });
    else documents.push({ ...document, conflict: { current } });
  }
  if (!changed) return state;
  return {
    documents,
    activeId: documents.some((document) => document.id === state.activeId)
      ? state.activeId
      : (documents[0]?.id ?? null),
  };
};

/** The user chose a side of a conflict: the disk copy replaces the draft, or the draft stays. */
export const resolveConflict = (
  document: ProfileDocument,
  keep: 'disk' | 'mine',
): ProfileDocument | null => {
  const current = document.conflict?.current ?? null;
  if (keep === 'disk')
    return current === null
      ? null
      : fresh(
          document.id,
          { name: document.saved.name, content: current },
          true,
          document.revision + 1,
        );
  return {
    ...document,
    saved: { name: document.saved.name, content: current ?? '' },
    persisted: current !== null,
    conflict: null,
  };
};

export const reorderDocument = (
  state: ProfileDocumentsState,
  id: string,
  index: number,
): ProfileDocumentsState => {
  const from = state.documents.findIndex((document) => document.id === id);
  if (
    from < 0 ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= state.documents.length ||
    from === index
  )
    return state;
  const documents = [...state.documents];
  const [document] = documents.splice(from, 1);
  documents.splice(index, 0, document);
  return { ...state, documents };
};

/** Follows a completed rename on disk, or renames a note that is not saved yet. */
export const renameDocument = (
  state: ProfileDocumentsState,
  from: string,
  to: string,
): ProfileDocumentsState => ({
  ...state,
  documents: state.documents.map((document) =>
    document.saved.name === from
      ? { ...document, name: to, saved: { ...document.saved, name: to } }
      : document,
  ),
});
