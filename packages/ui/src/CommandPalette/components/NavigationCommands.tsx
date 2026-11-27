import type { NavigationCommandsProps } from '@/CommandPalette/types.ts';
import type { View } from '@/navigation.ts';
import { CommandGroup } from '@pitchcrew/design-system/command';
import { paletteViews } from '../constants.ts';
import { PaletteItem } from './PaletteItem.tsx';

/** Other words people may type for a page, such as the board's old name. */
const synonyms: Partial<Record<View, string>> = {
  home: ' needs you desk',
  pipeline: ' board kanban jobs',
  inbox: ' inbox',
};

export const NavigationCommands = ({ run, onNavigate }: NavigationCommandsProps) => (
  <CommandGroup heading="Pages">
    {paletteViews.map((view) => (
      <PaletteItem
        key={view.id}
        value={`go open ${view.title}${synonyms[view.id] ?? ''}`}
        icon={view.icon}
        label={`Open ${view.title}`}
        context={view.context}
        onSelect={run(() => onNavigate(view.id))}
      />
    ))}
  </CommandGroup>
);
