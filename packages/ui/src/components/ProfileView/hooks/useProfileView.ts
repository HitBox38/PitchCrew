import type { ProfileViewProps } from '@/components/ProfileView/types.ts';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import { useState, type FormEvent } from 'react';
import { useProfileSources } from '@/components/ProfileSources/hooks/useProfileSources.ts';

const newProfile = {
  name: 'profile.md',
  content: '# Your name\n\n- Describe one experience or achievement you can substantiate.\n',
};
export function useProfileView({ data, action, working }: ProfileViewProps) {
  const initial = data.profile[0] ?? newProfile;
  const [name, setName] = useState(initial.name);
  const [content, setContent] = useState(initial.content);
  const [saved, setSaved] = useState({ name: initial.name, content: initial.content });
  const [error, setError] = useState('');
  const dirty = name !== saved.name || content !== saved.content;
  const guard = useUnsavedChanges(dirty, () => {
    setName(saved.name);
    setContent(saved.content);
  });
  const sourceController = useProfileSources({
    data,
    action,
    working,
    requestImport: (action) =>
      guard.requestLeave(() => {
        setName(saved.name);
        setContent(saved.content);
        action();
      }),
    openImported: (note) => {
      setName(note.name);
      setContent(note.content);
      setSaved(note);
      setError('');
    },
  });
  const openNote = (note: { name: string; content: string }) =>
    guard.requestLeave(() => {
      setName(note.name);
      setContent(note.content);
      setSaved(note);
      setError('');
    });
  const createNote = () =>
    openNote({ name: 'new-note.md', content: '# Project\n\n- Add a source-backed fact.\n' });
  async function save(e: FormEvent) {
    e.preventDefault();
    if (working) return;
    const snapshot = { name, content };
    try {
      await action('/profile', 'PUT', snapshot, 'Profile note saved');
      setSaved(snapshot);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile.');
    }
  }
  return {
    data,
    working,
    name,
    setName,
    content,
    setContent,
    error,
    save,
    dirty,
    guard,
    openNote,
    createNote,
    sourceController,
  };
}
