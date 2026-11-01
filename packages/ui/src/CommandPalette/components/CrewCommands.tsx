import type { CrewCommandsProps } from '@/CommandPalette/types.ts';
import { CommandGroup } from '@pitchcrew/design-system/command';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { SlidersHorizontal } from 'lucide-react';
import { PaletteItem } from './PaletteItem.tsx';

export const CrewCommands = ({ roles, run, onChatRole, onConfigureRole }: CrewCommandsProps) => (
  <CommandGroup heading="Crew">
    {roles
      .filter((role) => !role.retiredAt)
      .flatMap((role) => [
        <PaletteItem
          key={`chat-${role.id}`}
          value={`chat talk ${role.name}`}
          mark={<RoleAvatar agentRole={role.id} size="small" />}
          label={`Chat with ${role.name}`}
          context={role.enabled ? undefined : 'Paused'}
          onSelect={run(() => onChatRole(role.id))}
        />,
        <PaletteItem
          key={`configure-${role.id}`}
          value={`configure ${role.name}`}
          icon={SlidersHorizontal}
          label={`Configure ${role.name}`}
          onSelect={run(() => onConfigureRole(role.id))}
        />,
      ])}
  </CommandGroup>
);
