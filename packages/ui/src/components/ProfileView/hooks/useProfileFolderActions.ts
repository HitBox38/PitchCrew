import { useState } from 'react';
import type { ProfileFolderOperation, ProfileTreeModel, ProfileViewModel } from '../types.ts';

/** Folder-level explorer actions: new folder, move a note, rename or delete a folder. */
export const useProfileFolderActions = (controller: ProfileViewModel, tree: ProfileTreeModel) => {
  const [operation, setOperation] = useState<ProfileFolderOperation | null>(null);
  const start = (next: ProfileFolderOperation) => {
    controller.organization.clearError();
    setOperation(next);
  };
  const submit = async (folder: string) => {
    if (!operation || controller.working) return;
    const changed = await controller.organization.change(
      operation.kind === 'create'
        ? { action: 'create', path: folder }
        : operation.kind === 'move'
          ? { action: 'move', name: operation.name, folder }
          : { action: 'rename-folder', from: operation.path, to: folder },
    );
    if (changed) {
      tree.reveal(folder);
      setOperation(null);
    }
  };
  const removeFolder = (path: string) =>
    void controller.organization.change({ action: 'delete-folder', path });
  return { operation, start, submit, removeFolder, close: () => setOperation(null) };
};
