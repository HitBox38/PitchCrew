import { useState } from 'react';
import type { ProfileFolderOperation, ProfileTreeModel, ProfileViewModel } from '../types.ts';

export const useProfileFolderActions = (controller: ProfileViewModel, tree: ProfileTreeModel) => {
  const [operation, setOperation] = useState<ProfileFolderOperation | null>(null);
  const start = (next: ProfileFolderOperation) => {
    controller.organization.clearError();
    setOperation(next);
  };
  const submit = async (folder: string) => {
    if (!operation || controller.working) return;
    if (operation.kind === 'rename') {
      controller.renameNote(operation.note, folder);
      setOperation(null);
      return;
    }
    const changed = await controller.organization.change(
      operation.kind === 'create'
        ? { action: 'create', path: folder }
        : { action: 'move', name: operation.name, folder },
    );
    if (changed) {
      tree.reveal(folder);
      setOperation(null);
    }
  };
  return { operation, start, submit, close: () => setOperation(null) };
};
