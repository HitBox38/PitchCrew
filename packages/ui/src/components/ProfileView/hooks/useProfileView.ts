import type { ProfileViewProps } from '@/components/ProfileView/types.ts';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import { useState, type FormEvent } from 'react';
import { useProfileSources } from '@/components/ProfileSources/hooks/useProfileSources.ts';
import { useProfileDocuments } from './useProfileDocuments.ts';
import { documentDirty } from '../helpers.ts';

export function useProfileView({ data, action, working }: ProfileViewProps) {
  const documents = useProfileDocuments(data);
  const [closing, setClosing] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const guard = useUnsavedChanges(documents.dirty, documents.discard);
  const sourceController = useProfileSources({
    data,
    action,
    working,
    requestImport: (action) =>
      guard.requestLeave(() => {
        documents.discard();
        action();
      }),
    openImported: (note) => {
      documents.open(note, true);
      setSourcesOpen(false);
    },
  });
  const createNote = () => {
    const names = new Set([
      ...data.profile.map((file) => file.name),
      ...documents.documents.map((file) => file.name),
    ]);
    let name = 'new-note.md';
    for (let index = 2; names.has(name); index++) name = `new-note-${index}.md`;
    documents.open({ name, content: '# Project\n\n- Add a source-backed fact.\n' });
  };
  async function save(e: FormEvent) {
    e.preventDefault();
    const note = documents.active;
    if (working || !note) return;
    const snapshot = { name: note.name, content: note.content };
    try {
      await action('/profile', 'PUT', snapshot, 'Profile note saved');
      documents.update(note.id, { saved: snapshot, error: '' });
    } catch (e) {
      documents.update(note.id, {
        error: e instanceof Error ? e.message : 'Could not save profile.',
      });
    }
  }
  return {
    data,
    working,
    name: documents.active?.name ?? '',
    content: documents.active?.content ?? '',
    error: documents.active?.error ?? '',
    dirty: documents.active ? documentDirty(documents.active) : false,
    setName: (name: string) => {
      if (documents.active) documents.update(documents.active.id, { name });
    },
    setContent: (content: string) => {
      if (documents.active) documents.update(documents.active.id, { content });
    },
    save,
    openNote: documents.open,
    createNote,
    documents: documents.documents,
    activeId: documents.activeId,
    selectNote: documents.select,
    closeNote: (id: string) => {
      const note = documents.documents.find((document) => document.id === id);
      if (note && documentDirty(note)) setClosing(id);
      else documents.close(id);
    },
    guard: {
      ...guard,
      open: Boolean(closing) || guard.open,
      discard: () => {
        if (closing) {
          documents.close(closing);
          setClosing(null);
        } else guard.discard();
      },
      keepEditing: () => {
        setClosing(null);
        guard.keepEditing();
      },
    },
    sourceController,
    sourcesOpen,
    setSourcesOpen,
  };
}
