import { useState } from 'react';
import type { ProfileFolderOperation, ProfileNotesProps } from '../types.ts';
import type { useProfileNotes } from './useProfileNotes.ts';

export const useProfileFolderActions = (
  props: ProfileNotesProps,
  notes: ReturnType<typeof useProfileNotes>,
) => {
  const [operation, setOperation] = useState<ProfileFolderOperation | null>(null);
  const start = (next: ProfileFolderOperation) => {
    props.organization.clearError();
    setOperation(next);
  };
  const submit = async (folder: string) => {
    if (!operation || props.working) return;
    const changed = await props.organization.change(
      operation.kind === 'create'
        ? { action: 'create', path: folder }
        : { action: 'move', name: operation.name, folder },
    );
    if (changed) {
      notes.reveal(folder);
      setOperation(null);
    }
  };
  return { operation, start, submit, close: () => setOperation(null) };
};
