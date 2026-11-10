import { Copy, FilePen, FolderInput, Trash2 } from 'lucide-react';
import { menuComponents } from '@pitchcrew/design-system/menu-components';
import { DropdownMenuShortcut } from '@pitchcrew/design-system/dropdown-menu';
import { copyText } from '@/lib/clipboard.ts';
import type { ProfileTreeNode } from '../types.ts';
import { ProfileFolderMenuItems } from './ProfileFolderMenuItems.tsx';

export interface ProfileTreeRowActions {
  createNote: (folder: string) => void;
  createFolder: (parent: string) => void;
  renameFolder: (path: string) => void;
  deleteFolder: (path: string) => void;
  move: (node: ProfileTreeNode) => void;
  rename: (node: ProfileTreeNode) => void;
  remove: (node: ProfileTreeNode) => void;
}

/** One action list for a row's ⋯ menu and its right-click menu. */
export const ProfileTreeMenuItems = ({
  node,
  working,
  blocked = '',
  actions,
  context = false,
}: {
  node: ProfileTreeNode;
  working: boolean;
  /** Why notes cannot change on disk right now (an agent run), or empty. */
  blocked?: string;
  actions: ProfileTreeRowActions;
  context?: boolean;
}) => {
  const Menu = menuComponents(context);
  if (node.folder)
    return (
      <ProfileFolderMenuItems node={node} working={working} actions={actions} context={context} />
    );
  return (
    <>
      <Menu.Group>
        <Menu.Item
          disabled={working || !!blocked}
          title={blocked || undefined}
          onClick={() => actions.rename(node)}
        >
          <FilePen /> Rename…
          <DropdownMenuShortcut className="md-key-hint">F2</DropdownMenuShortcut>
        </Menu.Item>
        <Menu.Item
          disabled={working || !!blocked}
          title={blocked || undefined}
          onClick={() => actions.move(node)}
        >
          <FolderInput /> Move to folder…
        </Menu.Item>
        <Menu.Item onClick={() => copyText(node.note!.name, 'Copied the filename')}>
          <Copy /> Copy filename
        </Menu.Item>
      </Menu.Group>
      <Menu.Separator />
      <Menu.Group>
        <Menu.Item
          variant="destructive"
          disabled={working || !!blocked}
          title={blocked || undefined}
          onClick={() => actions.remove(node)}
        >
          <Trash2 /> Delete…
          <DropdownMenuShortcut className="md-key-hint">Del</DropdownMenuShortcut>
        </Menu.Item>
      </Menu.Group>
    </>
  );
};
