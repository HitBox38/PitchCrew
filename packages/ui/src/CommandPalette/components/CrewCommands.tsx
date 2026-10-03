import type { CrewCommandsProps } from '@/CommandPalette/types.ts';
import { CommandGroup } from '@/components/ui/command/components/CommandGroup.tsx';
import { CommandItem } from '@/components/ui/command/components/CommandItem.tsx';
import { MessageSquare, SlidersHorizontal } from 'lucide-react';

export function CrewCommands({ roles, run, onChatRole, onConfigureRole }: CrewCommandsProps) {
  return (
    <CommandGroup heading="Crew">
      {roles
        .filter((role) => !role.retiredAt)
        .map((role) => (
          <div key={role.id}>
            <CommandItem value={`chat talk ${role.name}`} onSelect={run(() => onChatRole(role.id))}>
              <MessageSquare /> Chat with {role.name}
            </CommandItem>
            <CommandItem
              value={`configure ${role.name}`}
              onSelect={run(() => onConfigureRole(role.id))}
            >
              <SlidersHorizontal /> Configure {role.name}
            </CommandItem>
          </div>
        ))}
    </CommandGroup>
  );
}
