import { FilePlus2, FolderPlus, Search, X } from 'lucide-react';
import { Input } from '@pitchcrew/design-system/input';
import { Button } from '@pitchcrew/design-system/button';
import { ProfileNotesLocation } from './ProfileNotesLocation.tsx';

/**
 * The explorer's head, like a code editor's: a "Notes" row with new note, new folder and where
 * notes live, then a full-width search over names and text.
 */
export const ProfileTreeSearch = ({
  query,
  setQuery,
  folder,
  directory,
  count,
  working,
  createNote,
  createFolder,
  restore,
}: {
  query: string;
  setQuery: (query: string) => void;
  folder: string;
  directory: string;
  count: number;
  working: boolean;
  createNote: () => void;
  createFolder: () => void;
  restore: (trashId: string) => Promise<boolean>;
}) => {
  const where = folder ? `in ${folder}` : 'at the top level';
  return (
    <div className="profile-tree-head">
      <div className="profile-tree-title">
        <h2>
          {query.trim() ? 'Results' : 'Notes'} <span className="profile-tree-count">{count}</span>
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`New note ${where}`}
          title={`New note ${where}`}
          disabled={working}
          onClick={createNote}
        >
          <FilePlus2 size={16} aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`New folder ${where}`}
          title={`New folder ${where}`}
          disabled={working}
          onClick={createFolder}
        >
          <FolderPlus size={16} aria-hidden="true" />
        </Button>
        <ProfileNotesLocation directory={directory} restore={restore} />
      </div>
      <div className="profile-tree-search">
        <Search size={14} aria-hidden="true" className="profile-tree-search-icon" />
        <Input
          type="search"
          aria-label="Search notes by name or text"
          placeholder="Search names and text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && query) {
              event.preventDefault();
              setQuery('');
            }
          }}
        />
        {query ? (
          <button
            type="button"
            className="profile-tree-search-clear"
            aria-label="Clear search"
            onClick={() => setQuery('')}
          >
            <X size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
};
