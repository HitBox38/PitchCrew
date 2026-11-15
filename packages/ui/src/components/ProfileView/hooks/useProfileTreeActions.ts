import type { KeyboardEvent } from 'react';
import type {
  ProfileTreeModel,
  ProfileTreeNode,
  ProfileViewModel,
  ProfileWorkspaceModel,
} from '../types.ts';
import { useProfileFolderActions } from './useProfileFolderActions.ts';
import type { useProfileTreeKeyboard } from './useProfileTreeKeyboard.ts';

type Row = ProfileTreeModel['rows'][number];

/**
 * What explorer rows can do: note and folder actions for their menus, and the keys a code
 * editor's tree answers to (F2 renames, Delete deletes) on top of tree navigation.
 */
export const useProfileTreeActions = (
  controller: ProfileViewModel,
  tree: ProfileTreeModel,
  workspace: ProfileWorkspaceModel,
  keyboard: ReturnType<typeof useProfileTreeKeyboard>,
) => {
  const actions = useProfileFolderActions(controller, tree);
  const rowActions = {
    createNote: (folder: string) => workspace.createNote(folder),
    createFolder: (parent: string) => actions.start({ kind: 'create', parent }),
    renameFolder: (path: string) => actions.start({ kind: 'rename-folder', path }),
    deleteFolder: actions.removeFolder,
    move: (node: ProfileTreeNode) =>
      actions.start({ kind: 'move', name: node.note!.name, current: node.path }),
    rename: (node: ProfileTreeNode) =>
      workspace.setDialog({ kind: 'rename', name: node.note!.name }),
    remove: (node: ProfileTreeNode) =>
      workspace.setDialog({ kind: 'delete', name: node.note!.name }),
  };
  const rowKeyDown = (event: KeyboardEvent, row: Row) => {
    const editable = row.node.note && !controller.blocker;
    if (editable && event.key === 'F2') rowActions.rename(row.node);
    else if (editable && ['Delete', 'Backspace'].includes(event.key)) rowActions.remove(row.node);
    else return keyboard.keyDown(event, row);
    event.preventDefault();
  };
  return { actions, rowActions, rowKeyDown };
};
