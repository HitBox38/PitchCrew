import type { ProfileNotesProps } from '@/components/ProfileView/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { useProfileNotes } from '../hooks/useProfileNotes.ts';
import { FileText, Plus, Search, ChevronDown, FolderOpen } from 'lucide-react';

export function ProfileNotes(props: ProfileNotesProps) {
  const { data, name, openNote, createNote } = props;
  const { query, setQuery, notes, paths } = useProfileNotes(props);
  return (
    <aside
      id="profile-explorer"
      className="profile-aside"
      aria-label="Notes explorer"
      hidden={props.hidden}
    >
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold">Explorer</h2>
        <Button
          variant="ghost"
          className="profile-explorer-toggle"
          onClick={createNote}
          aria-label="New note"
          title="New note"
        >
          <Plus size={16} />
        </Button>
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
      <div className="flex shrink-0 items-center gap-1.5 px-3 pb-2 text-xs text-muted-foreground">
        <ChevronDown size={14} />
        <FolderOpen size={14} /> profile
      </div>
      <nav className="profile-notes flex flex-col gap-0.5" aria-label="Profile notes">
        {notes.length ? (
          notes.map((file) => (
            <Button
              key={file.name}
              onClick={() => openNote(file)}
              aria-pressed={name === file.name}
              className={`profile-file ${name === file.name ? 'selected' : ''}`}
            >
              <FileText size={15} />
              <span title={paths.get(file.name) ?? file.name}>
                {paths.get(file.name) ?? file.name}
              </span>
            </Button>
          ))
        ) : (
          <p className="quiet px-3 py-2">
            {data.profile.length ? 'No notes match your search.' : 'No notes saved yet.'}
          </p>
        )}
      </nav>
      <div className="profile-tip">
        <h3>Notes your crew can use</h3>
        <p>
          One fact per bullet: what you built, for whom, and what changed. Only include numbers you
          could back up in an interview.
        </p>
      </div>
    </aside>
  );
}
