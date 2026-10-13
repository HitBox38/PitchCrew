import { useState, type FormEvent } from 'react';
import type { ProfileFolderOperation } from '../types.ts';

export function useProfileFolderDialog(
  operation: ProfileFolderOperation,
  folders: string[],
  submit: (folder: string) => Promise<void>,
) {
  const [folder, setFolder] = useState(
    operation.kind === 'create' ? operation.parent : operation.current,
  );
  const [name, setName] = useState('');
  const [validation, setValidation] = useState('');
  const create = operation.kind === 'create';
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (create && (!name.trim() || name.includes('/') || name.includes('\\'))) {
      setValidation('Use a folder name without slashes or backslashes.');
      return;
    }
    const path = create ? [folder, name.trim()].filter(Boolean).join('/') : folder;
    if (create && folders.includes(path)) {
      setValidation('A folder with this name already exists here.');
      return;
    }
    setValidation('');
    void submit(path);
  };
  return { folder, setFolder, name, setName, validation, create, save };
}
