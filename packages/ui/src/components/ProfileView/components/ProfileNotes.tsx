import type { ProfileNotesProps } from '@/components/ProfileView/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { FileText, Plus } from 'lucide-react';

export function ProfileNotes({ data, name, setName, setContent }: ProfileNotesProps) {
  return (
    <aside className="profile-aside">
      <h3>Notes</h3>
      {data.profile.length ? (
        data.profile.map((file) => (
          <Button
            key={file.name}
            onClick={() => {
              setName(file.name);
              setContent(file.content);
            }}
            className={`profile-file ${name === file.name ? 'selected' : ''}`}
          >
            <FileText size={15} />
            {file.name}
          </Button>
        ))
      ) : (
        <p className="quiet">No notes saved yet.</p>
      )}
      <Button
        className="text-button"
        onClick={() => {
          setName('new-note.md');
          setContent('# Project\n\n- Add a source-backed fact.\n');
        }}
      >
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
