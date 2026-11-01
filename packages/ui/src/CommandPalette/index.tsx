import { commandFilter } from './helpers.ts';
import { CrewCommands } from '@/CommandPalette/components/CrewCommands.tsx';
import { RankedResults } from '@/CommandPalette/components/RankedResults.tsx';
import { WorkspaceCommands } from '@/CommandPalette/components/WorkspaceCommands.tsx';
import { useCommandPalette } from '@/CommandPalette/hooks/useCommandPalette.ts';
import type { CommandPaletteProps } from '@/CommandPalette/types.ts';
import { CommandDialog, CommandInput, CommandList } from '@pitchcrew/design-system/command';
import { PaletteEmpty } from './components/PaletteEmpty.tsx';

/** Actions, Jobs, Conversations, Pages, Settings and Crew in one 600px search sheet. */
export const CommandPalette = (props: CommandPaletteProps) => {
  const controller = useCommandPalette(props);
  const { open, onOpenChange } = controller;
  return (
    <CommandDialog
      commandProps={{ filter: commandFilter }}
      open={open}
      onOpenChange={onOpenChange}
      title="Search Pitchcrew"
      description="Run an action or open a job, conversation, page, setting or agent."
      className="command-palette"
      showCloseButton={false}
    >
      <CommandInput placeholder="Search or run a command" />
      <CommandList>
        <PaletteEmpty />
        <WorkspaceCommands {...controller} />
        <RankedResults {...controller} />
        <CrewCommands {...controller} />
      </CommandList>
    </CommandDialog>
  );
};
