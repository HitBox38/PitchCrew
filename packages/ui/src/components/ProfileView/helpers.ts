import type { ProfileDocument, ProfileDocumentsState } from './types.ts';

export const documentDirty = (document: ProfileDocument) => {
  return document.name !== document.saved.name || document.content !== document.saved.content;
};

export const openDocument = (
  state: ProfileDocumentsState,
  note: { name: string; content: string },
  id: string,
  replace = false,
): ProfileDocumentsState => {
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
};

export const closeDocument = (state: ProfileDocumentsState, id: string): ProfileDocumentsState => {
  const index = state.documents.findIndex((document) => document.id === id);
  const documents = state.documents.filter((document) => document.id !== id);
  return {
    documents,
    activeId:
      state.activeId === id
        ? (documents[Math.min(index, documents.length - 1)]?.id ?? null)
        : state.activeId,
  };
};

export const discardDocuments = (state: ProfileDocumentsState): ProfileDocumentsState => {
  return {
    ...state,
    documents: state.documents.map((document) => ({ ...document, ...document.saved, error: '' })),
  };
};

export const syncDocuments = (
  state: ProfileDocumentsState,
  notes: { name: string; content: string }[],
): ProfileDocumentsState => {
  let changed = false;
  const documents = state.documents.map((document) => {
    const note = notes.find((note) => note.name === document.saved.name);
    if (!note || documentDirty(document) || note.content === document.content) return document;
    changed = true;
    return { ...document, ...note, saved: note, error: '' };
  });
  return changed ? { ...state, documents } : state;
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

export const initialProfileNote = {
  name: 'profile.md',
  content: '# Your name\n\n- Describe one experience or achievement you can substantiate.\n',
};

/** Opens the note if needed and drafts a new filename; saving writes under that filename. */
export const renameDocument = (
  state: ProfileDocumentsState,
  note: { name: string; content: string },
  id: string,
  name: string,
): ProfileDocumentsState => {
  const opened = openDocument(state, note, id);
  return {
    ...opened,
    documents: opened.documents.map((document) =>
      document.id === opened.activeId ? { ...document, name } : document,
    ),
  };
};

export const wordCount = (content: string) => {
  const text = content.trim();
  return text ? text.split(/\s+/u).length : 0;
};

/** Profile notes are written only while no agent run is active (the daemon enforces it). */
export const saveBlocker = (runs: { status: string }[], proposals: { status: string }[] = []) => {
  if (proposals.some((proposal) => proposal.status === 'applying'))
    return 'Finish the approved source update in Sources to save';
  const running = runs.filter((run) => run.status === 'running').length;
  if (!running) return '';
  return `Save available after ${running} ${running === 1 ? 'run finishes' : 'runs finish'}`;
};

interface CitedCard {
  id: string;
  company: string;
  title: string;
  state: string;
  packet: { claims: { source: string; quote: string }[] } | null;
}
/** Jobs whose current packet registers claims quoting this exact profile note. */
export const noteCitations = (cards: CitedCard[], name: string) =>
  cards.flatMap((card) => {
    const quotes = [
      ...new Set(
        (card.packet?.claims ?? [])
          .filter((claim) => claim.source === name)
          .map((claim) => claim.quote),
      ),
    ];
    return quotes.length
      ? [{ id: card.id, company: card.company, title: card.title, state: card.state, quotes }]
      : [];
  });

/** Compact rail rows: a packet quoting exactly the same lines as an earlier one names it instead. */
export const citationRows = <T extends { company: string; quotes: string[] }>(cited: T[]) =>
  cited.map((card, index) => {
    const key = card.quotes.join('\n');
    const earlier = cited.slice(0, index).find((other) => other.quotes.join('\n') === key);
    return { ...card, sameAs: earlier?.company ?? '' };
  });

/** One line naming a saved maintenance proposal, from its stored documents and source. */
export const proposalNotice = (proposal: {
  status: string;
  source: { label: string; input: { provider: string } };
  documents: { path: string }[];
  observation?: unknown;
}) => {
  const where = proposal.source.input.provider === 'github' ? 'GitHub' : 'Google Drive';
  const count = proposal.documents.length;
  const names = proposal.documents.map((file) => file.path.split('/').at(-1) ?? file.path);
  if (proposal.status === 'applying')
    return {
      tone: 'ochre',
      title: 'Approved update needs recovery',
      detail: proposal.source.label,
    };
  if (!count)
    return { tone: 'primary', title: `Project changed on ${where}`, detail: proposal.source.label };
  return {
    tone: 'primary',
    title: `${count} ${count === 1 ? 'note' : 'notes'} changed on ${where}`,
    detail: names.join(', '),
  };
};

/** Mirrors the daemon's simple Markdown filename rule and refuses to overwrite another note. */
export const filenameProblem = (name: string, taken: string[]) => {
  if (!/^[\w.-]+\.md$/.test(name) || name.includes('..'))
    return 'Use letters, numbers, dots, dashes or underscores, ending in .md.';
  if (taken.includes(name)) return 'Another note already uses this filename.';
  return '';
};
