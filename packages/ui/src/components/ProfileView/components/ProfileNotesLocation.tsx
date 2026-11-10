import { useState } from 'react';
import { Copy, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@pitchcrew/design-system/dropdown-menu';
import { copyText } from '@/lib/clipboard.ts';
import { ProfileTrashDialog } from './ProfileTrashDialog.tsx';

/** Notes options: recently deleted notes, and where the Markdown files live on this device. */
export const ProfileNotesLocation = ({
  directory,
  restore,
}: {
  directory: string;
  restore: (trashId: string) => Promise<boolean>;
}) => {
  const [trash, setTrash] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" />}
          aria-label="Notes options"
        >
          <MoreHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setTrash(true)}>
              <Trash2 size={15} /> Recently deleted…
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel className="profile-tree-path" title={directory}>
              Saved on this device in {directory}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => copyText(directory, 'Copied the notes folder path')}>
              <Copy size={15} /> Copy notes folder path
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {trash ? <ProfileTrashDialog close={() => setTrash(false)} restore={restore} /> : null}
    </>
  );
};
