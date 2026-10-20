import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { FilePlus2, FolderPlus, Search } from 'lucide-react';

export const ProfileExplorerControls = ({
  query,
  setQuery,
  folder,
  working,
  createNote,
  createFolder,
}: {
  query: string;
  setQuery: (query: string) => void;
  folder: string;
  working: boolean;
  createNote: () => void;
  createFolder: () => void;
}) => {
  return (
    <>
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold">Explorer</h2>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            className="profile-explorer-toggle"
            onClick={createNote}
            disabled={working}
            aria-label="New note"
            title={`New note in ${folder || 'profile'}`}
          >
            <FilePlus2 size={16} />
          </Button>
          <Button
            variant="ghost"
            className="profile-explorer-toggle"
            onClick={createFolder}
            disabled={working}
            aria-label="New folder"
            title={`New folder in ${folder || 'profile'}`}
          >
            <FolderPlus size={16} />
          </Button>
        </div>
      </div>
      <div className="relative mx-3 mb-3 shrink-0">
        <Search
          size={14}
          className="pointer-events-none absolute top-2.5 left-2.5 text-muted-foreground"
        />
        <Input
          className="h-8 pl-8 text-xs"
          aria-label="Search profile notes"
          placeholder="Search notes…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
    </>
  );
};
