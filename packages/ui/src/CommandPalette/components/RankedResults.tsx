import { useCommandState } from 'cmdk';
import type { CommandPaletteModel } from '../types.ts';
import { settingsRankFirst } from '../helpers.ts';
import { ConversationCommands } from './ConversationCommands.tsx';
import { JobCommands } from './JobCommands.tsx';
import { NavigationCommands } from './NavigationCommands.tsx';
import { SettingsCommands } from './SettingsCommands.tsx';

/**
 * Jobs, Conversations, Pages, then Settings. When a search matches a setting more strongly than
 * any job, Settings moves to the front of this block.
 */
export const RankedResults = (props: CommandPaletteModel) => {
  const search = useCommandState((state) => state.search);
  const settings = <SettingsCommands {...props} />;
  const first = settingsRankFirst(props.cards, search);
  return (
    <>
      {first ? settings : null}
      {props.cards.length ? <JobCommands {...props} /> : null}
      <ConversationCommands {...props} />
      <NavigationCommands {...props} />
      {first ? null : settings}
    </>
  );
};
