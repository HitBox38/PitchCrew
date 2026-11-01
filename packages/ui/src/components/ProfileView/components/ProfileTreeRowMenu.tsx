import { FilePen, FilePlus2, FolderInput, FolderPlus, MoreHorizontal } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@pitchcrew/design-system/dropdown-menu';
import type { ProfileTreeNode } from '../types.ts';

export interface ProfileTreeRowActions {
  createNote: (folder: string) => void;
  createFolder: (parent: string) => void;
  move: (node: ProfileTreeNode) => void;
  rename: (node: ProfileTreeNode) => void;
}

export const ProfileTreeRowMenu = ({
  node,
  tabIndex,
  working,
  actions,
}: {
  node: ProfileTreeNode;
  tabIndex: number;
  working: boolean;
  actions: ProfileTreeRowActions;
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-xs" className="profile-row-menu" />}
        aria-label={`Actions for ${node.label}`}
        tabIndex={tabIndex}
      >
        <MoreHorizontal size={14} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {node.folder ? (
          <>
            <DropdownMenuItem disabled={working} onClick={() => actions.createNote(node.path)}>
              <FilePlus2 size={15} /> New note here
            </DropdownMenuItem>
            <DropdownMenuItem disabled={working} onClick={() => actions.createFolder(node.path)}>
              <FolderPlus size={15} /> New folder inside
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem disabled={working} onClick={() => actions.move(node)}>
              <FolderInput size={15} /> Move to folder…
            </DropdownMenuItem>
            <DropdownMenuItem disabled={working} onClick={() => actions.rename(node)}>
              <FilePen size={15} /> Change filename…
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
