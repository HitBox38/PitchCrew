import { useCommandState } from 'cmdk';
import { CommandEmpty } from '@pitchcrew/design-system/command';

export const PaletteEmpty = () => {
  const search = useCommandState((state) => state.search);
  return <CommandEmpty>No matches for “{search.trim()}”</CommandEmpty>;
};
