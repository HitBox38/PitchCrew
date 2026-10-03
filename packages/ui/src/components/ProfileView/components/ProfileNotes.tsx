import type { ProfileNotesProps } from '@/components/ProfileView/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { FileText, Plus } from 'lucide-react';

export function ProfileNotes({ data, name, openNote, createNote }: ProfileNotesProps) {
  return (
    <aside className="profile-aside">
      <h3>Notes</h3>
      <div className="profile-notes">
        {data.profile.length ? (
          data.profile.map((file) => (
            <Button
              key={file.name}
              onClick={() => openNote(file)}
              aria-pressed={name === file.name}
              className={`profile-file ${name === file.name ? 'selected' : ''}`}
            >
              <FileText size={15} />
              <span>{file.name}</span>
            </Button>
          ))
        ) : (
          <p className="quiet">No notes saved yet.</p>
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
