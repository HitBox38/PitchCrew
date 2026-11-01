import type { WorkspaceCommandsProps } from '@/CommandPalette/types.ts';
import { CommandGroup } from '@pitchcrew/design-system/command';
import { FilePlus2, MessageSquarePlus, Plus } from 'lucide-react';
import { PaletteItem } from './PaletteItem.tsx';

/**
 * The few everyday things to create, named by their consequence. Theme, runtime, data and update
 * commands live under Settings so they never push jobs out of view.
 */
export const WorkspaceCommands = ({
  run,
  onAddJob,
  onNewConversation,
  onNewNote,
}: WorkspaceCommandsProps) => (
  <CommandGroup heading="Actions">
    <PaletteItem
      value="add job new"
      icon={Plus}
      label="Add job"
      shortcut="N"
      onSelect={run(onAddJob)}
    />
    <PaletteItem
      value="new conversation chat"
      icon={MessageSquarePlus}
      label="New conversation"
      onSelect={run(onNewConversation)}
    />
    <PaletteItem
      value="new note profile"
      icon={FilePlus2}
      label="New note"
      onSelect={run(onNewNote)}
    />
  </CommandGroup>
);
