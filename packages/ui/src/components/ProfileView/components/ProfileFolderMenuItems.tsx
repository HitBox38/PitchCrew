import { FilePlus2, FolderPen, FolderPlus, FolderX } from 'lucide-react';
import { menuComponents } from '@pitchcrew/design-system/menu-components';
import type { ProfileTreeNode } from '../types.ts';
import type { ProfileTreeRowActions } from './ProfileTreeMenuItems.tsx';

/** A folder's actions: new note or folder inside, rename, and delete when it is empty. */
export const ProfileFolderMenuItems = ({
  node,
  working,
  actions,
  context,
}: {
  node: ProfileTreeNode;
  working: boolean;
  actions: ProfileTreeRowActions;
  context: boolean;
}) => {
  const Menu = menuComponents(context);
  return (
    <>
      <Menu.Group>
        <Menu.Item disabled={working} onClick={() => actions.createNote(node.path)}>
          <FilePlus2 /> New note here
        </Menu.Item>
        <Menu.Item disabled={working} onClick={() => actions.createFolder(node.path)}>
          <FolderPlus /> New folder inside
        </Menu.Item>
      </Menu.Group>
      <Menu.Separator />
      <Menu.Group>
        <Menu.Item
          disabled={working || !node.explicit}
          title={node.explicit ? undefined : 'Folders from an imported source follow its paths'}
          onClick={() => actions.renameFolder(node.path)}
        >
          <FolderPen /> Rename folder…
        </Menu.Item>
        <Menu.Item
          variant="destructive"
          disabled={working || node.children.length > 0 || !node.explicit}
          onClick={() => actions.deleteFolder(node.path)}
        >
          <FolderX />{' '}
          {node.children.length ? 'Delete folder (move notes out first)' : 'Delete folder'}
        </Menu.Item>
      </Menu.Group>
    </>
  );
};
