import { viewIcons, viewTitles } from '@/AppSidebar/constants.ts';
import type { NavigationCommandsProps } from '@/CommandPalette/types.ts';
import { CommandGroup } from '@/components/ui/command/components/CommandGroup.tsx';
import { CommandItem } from '@/components/ui/command/components/CommandItem.tsx';
import type { View } from '@/navigation.ts';

export function NavigationCommands({ run, onNavigate }: NavigationCommandsProps) {
  return (
    <CommandGroup heading="Go to">
      {(Object.keys(viewTitles) as View[]).map((id) => {
        const Icon = viewIcons[id];
        return (
          <CommandItem key={id} value={`go ${viewTitles[id]}`} onSelect={run(() => onNavigate(id))}>
            <Icon /> {viewTitles[id]}
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}
