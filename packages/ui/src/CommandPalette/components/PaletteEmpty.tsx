import { useCommandState } from 'cmdk';
import { CommandEmpty } from '@/components/ui/command/components/CommandEmpty.tsx';

export const PaletteEmpty = () => {
  const search = useCommandState((state) => state.search);
  return <CommandEmpty>No matches for “{search.trim()}”</CommandEmpty>;
};
