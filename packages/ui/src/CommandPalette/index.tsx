import { CrewCommands } from '@/CommandPalette/components/CrewCommands.tsx';
import { JobCommands } from '@/CommandPalette/components/JobCommands.tsx';
import { NavigationCommands } from '@/CommandPalette/components/NavigationCommands.tsx';
import { WorkspaceCommands } from '@/CommandPalette/components/WorkspaceCommands.tsx';
import { useCommandPalette } from '@/CommandPalette/hooks/useCommandPalette.ts';
import type { CommandPaletteProps } from '@/CommandPalette/types.ts';
import { CommandDialog } from '@/components/ui/command/components/CommandDialog.tsx';
import { CommandEmpty } from '@/components/ui/command/components/CommandEmpty.tsx';
import { CommandInput } from '@/components/ui/command/components/CommandInput.tsx';
import { CommandList } from '@/components/ui/command/components/CommandList.tsx';
import { CommandSeparator } from '@/components/ui/command/components/CommandSeparator.tsx';

export function CommandPalette(props: CommandPaletteProps) {
  const controller = useCommandPalette(props);
  const { open, onOpenChange, cards } = controller;
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search Pitchcrew"
      description="Jump to a view, a job or a role, or run an action."
      className="command-palette"
      showCloseButton={false}
    >
      <CommandInput placeholder="Search jobs, views and actions…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <NavigationCommands {...controller} />
        {cards.length ? <JobCommands {...controller} /> : null}
        <CrewCommands {...controller} />
        <CommandSeparator />
        <WorkspaceCommands {...controller} />
      </CommandList>
    </CommandDialog>
  );
}
