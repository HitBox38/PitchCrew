import type { NavigationCommandsProps } from '@/CommandPalette/types.ts';
import { CommandGroup } from '@/components/ui/command/components/CommandGroup.tsx';
import { paletteViews } from '../constants.ts';
import { PaletteItem } from './PaletteItem.tsx';

export const NavigationCommands = ({ run, onNavigate }: NavigationCommandsProps) => (
  <CommandGroup heading="Pages">
    {paletteViews.map((view) => (
      <PaletteItem
        key={view.id}
        value={`go open ${view.title}${view.id === 'inbox' ? ' inbox' : ''}`}
        icon={view.icon}
        label={`Open ${view.title}`}
        context={view.context}
        onSelect={run(() => onNavigate(view.id))}
      />
    ))}
  </CommandGroup>
);
