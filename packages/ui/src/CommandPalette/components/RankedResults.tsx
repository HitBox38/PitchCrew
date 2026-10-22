import { useCommandState } from 'cmdk';
import { SettingCommands } from '@/SettingsPage/components/SettingCommands.tsx';
import type { CommandPaletteModel } from '../types.ts';
import { settingsRankFirst } from '../helpers.ts';
import { JobCommands } from './JobCommands.tsx';

/** Jobs and settings appear in order of their strongest match for the current search. */
export const RankedResults = (props: CommandPaletteModel) => {
  const search = useCommandState((state) => state.search);
  const jobs = props.cards.length ? <JobCommands {...props} /> : null;
  const settings = <SettingCommands run={props.run} />;
  return settingsRankFirst(props.cards, search) ? (
    <>
      {settings}
      {jobs}
    </>
  ) : (
    <>
      {jobs}
      {settings}
    </>
  );
};
