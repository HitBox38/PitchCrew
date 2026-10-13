import type { ProfileDocument, ProfileDocumentsState } from './types.ts';

export const initialProfileNote = {
  name: 'profile.md',
  content: '# Your name\n\n- Describe one experience or achievement you can substantiate.\n',
};

export function documentDirty(document: ProfileDocument) {
  return document.name !== document.saved.name || document.content !== document.saved.content;
}

export function openDocument(
  state: ProfileDocumentsState,
  note: { name: string; content: string },
  id: string,
  replace = false,
): ProfileDocumentsState {
  const existing = state.documents.find((document) => document.saved.name === note.name);
  if (existing) {
    return {
      activeId: existing.id,
      documents: replace
        ? state.documents.map((document) =>
            document.id === existing.id
              ? { ...document, ...note, saved: note, error: '' }
              : document,
          )
        : state.documents,
    };
  }
  return {
    activeId: id,
    documents: [...state.documents, { id, ...note, saved: note, error: '' }],
  };
}

export function closeDocument(state: ProfileDocumentsState, id: string): ProfileDocumentsState {
  const index = state.documents.findIndex((document) => document.id === id);
  const documents = state.documents.filter((document) => document.id !== id);
  return {
    documents,
    activeId:
      state.activeId === id
        ? (documents[Math.min(index, documents.length - 1)]?.id ?? null)
        : state.activeId,
  };
}

export function discardDocuments(state: ProfileDocumentsState): ProfileDocumentsState {
  return {
    ...state,
    documents: state.documents.map((document) => ({ ...document, ...document.saved, error: '' })),
  };
}

export function syncDocuments(
  state: ProfileDocumentsState,
  notes: { name: string; content: string }[],
): ProfileDocumentsState {
  let changed = false;
  const documents = state.documents.map((document) => {
    const note = notes.find((note) => note.name === document.saved.name);
    if (!note || documentDirty(document) || note.content === document.content) return document;
    changed = true;
    return { ...document, ...note, saved: note, error: '' };
  });
  return changed ? { ...state, documents } : state;
}
