import { Copy, FilePlus2, FolderPlus, MoreHorizontal, Search } from 'lucide-react';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu/index.tsx';
import { copyText } from '@/lib/clipboard.ts';

export const ProfileTreeSearch = ({
  query,
  setQuery,
  folder,
  directory,
  working,
  createNote,
  createFolder,
}: {
  query: string;
  setQuery: (query: string) => void;
  folder: string;
  directory: string;
  working: boolean;
  createNote: () => void;
  createFolder: () => void;
}) => {
  const where = folder || 'profile folder';
  return (
    <div className="profile-tree-search">
      <div className="relative min-w-0 flex-1">
        <Search size={14} aria-hidden="true" className="profile-tree-search-icon" />
        <Input
          type="search"
          aria-label="Search profile notes"
          placeholder="Find a note"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" />}
          aria-label="Note tree actions"
        >
          <MoreHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>In {where}</DropdownMenuLabel>
            <DropdownMenuItem disabled={working} onClick={createNote}>
              <FilePlus2 size={15} /> New note
            </DropdownMenuItem>
            <DropdownMenuItem disabled={working} onClick={createFolder}>
              <FolderPlus size={15} /> New folder
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
    </div>
  );
};
