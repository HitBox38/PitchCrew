import type { ProfileNotesProps } from '@/components/ProfileView/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { useProfileNotes } from '../hooks/useProfileNotes.ts';
import { FileText, Plus } from 'lucide-react';

export function ProfileNotes(props: ProfileNotesProps) {
  const { data, name, openNote, createNote } = props;
  const { query, setQuery, notes, paths } = useProfileNotes(props);
  return (
    <aside className="profile-aside">
      <h3>Notes</h3>
      {data.profile.length > 5 ? (
        <Input
          aria-label="Search profile notes"
          placeholder="Search notes…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      ) : null}
      <div className="profile-notes">
        {notes.length ? (
          notes.map((file) => (
            <Button
              key={file.name}
              onClick={() => openNote(file)}
              aria-pressed={name === file.name}
              className={`profile-file ${name === file.name ? 'selected' : ''}`}
            >
              <FileText size={15} />
              <span title={file.name}>{paths.get(file.name) ?? file.name}</span>
            </Button>
          ))
        ) : (
          <p className="quiet">
            {data.profile.length ? 'No notes match your search.' : 'No notes saved yet.'}
          </p>
        )}
      </div>
      <Button className="text-button" onClick={createNote}>
        <Plus size={14} /> New note
      </Button>
      <div className="profile-tip">
        <h3>Writing useful notes</h3>
        <p>
          One fact per bullet: what you built, for whom, and what changed. Only include numbers you
          could back up in an interview.
        </p>
        <p>
          The demo writer uses your bullet points verbatim. Real runtimes can tailor the surrounding
          prose.
        </p>
      </div>
    </aside>
  );
}
