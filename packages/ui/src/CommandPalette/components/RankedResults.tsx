import { useCommandState } from 'cmdk';
import type { CommandPaletteModel } from '../types.ts';
import { anyNoteText, indexNotes, noteTextScore, settingsRankFirst } from '../helpers.ts';
import { ConversationCommands } from './ConversationCommands.tsx';
import { JobCommands } from './JobCommands.tsx';
import { NavigationCommands } from './NavigationCommands.tsx';
import { NoteCommands } from './NoteCommands.tsx';
import { SettingsCommands } from './SettingsCommands.tsx';

/**
 * Jobs, profile notes (while searching), Conversations, Pages, then Settings. When a search
 * matches a setting more strongly than any job or note text, Settings moves to the front.
 */
export const RankedResults = (props: CommandPaletteModel) => {
  const search = useCommandState((state) => state.search);
  const settings = <SettingsCommands {...props} />;
  indexNotes(props.notes);
  const first = settingsRankFirst(props.cards, search, anyNoteText(search) ? noteTextScore : 0);
  // Notes keep one place (moving a group remounts it and drops the palette's selection).
  return (
    <>
      {first ? settings : null}
      {props.cards.length ? <JobCommands {...props} /> : null}
      {search.trim() ? <NoteCommands {...props} /> : null}
      <ConversationCommands {...props} />
      <NavigationCommands {...props} />
      {first ? null : settings}
    </>
  );
};
