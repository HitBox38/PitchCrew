import { FileText } from 'lucide-react';
import { useCommandState } from 'cmdk';
import { CommandGroup } from '@pitchcrew/design-system/command';
import { Highlight } from '@/components/ProfileView/components/Highlight.tsx';
import { noteLabel } from '@/components/ProfileView/helpers.ts';
import { passage } from '@/components/ProfileView/tree.ts';
import { indexNotes, noteTextHit } from '../helpers.ts';
import type { NoteCommandsProps } from '../types.ts';
import { PaletteItem } from './PaletteItem.tsx';

const maxSnippets = 20;

/**
 * Profile notes by name, first heading or text. A note found by its text shows the matching
 * line and opens with the editor on it, like a search hit.
 */
export const NoteCommands = ({ notes, run, onOpenNote }: NoteCommandsProps) => {
  const search = useCommandState((state) => state.search).trim();
  // The palette's filter reads note text from this index (see `commandFilter`).
  const valueOf = indexNotes(notes);
  let snippets = 0;
  return (
    <CommandGroup heading="Profile notes">
      {notes.map((note) => {
        const value = valueOf(note);
        const title = /^#\s+(.+)$/m.exec(note.content)?.[1]?.trim().slice(0, 120);
        const found = noteTextHit(value, search);
        const hit = found && snippets < maxSnippets ? passage(note.content, found) : undefined;
        if (hit) snippets++;
        const label = noteLabel(note.name);
        return (
          <PaletteItem
            key={note.name}
            value={value}
            icon={FileText}
            label={label}
            context={
              hit ? (
                <Highlight text={hit.text} query={found} />
              ) : title && title.toLowerCase() !== label.toLowerCase() ? (
                title
              ) : undefined
            }
            onSelect={run(() => onOpenNote(note.name, found))}
          />
        );
      })}
    </CommandGroup>
  );
};
