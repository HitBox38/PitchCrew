import { themeOptions } from '@/AppSidebar/constants.ts';
import type { WorkspaceCommandsProps } from '@/CommandPalette/types.ts';
import { CommandGroup } from '@/components/ui/command/components/CommandGroup.tsx';
import { CommandItem } from '@/components/ui/command/components/CommandItem.tsx';
import { CommandShortcut } from '@/components/ui/command/components/CommandShortcut.tsx';
import { modKey } from '@/shortcuts.ts';
import { Copy, PanelLeft, Plus, RefreshCw } from 'lucide-react';

export function WorkspaceCommands({
  run,
  onAddJob,
  toggleSidebar,
  onCheckRuntimes,
  onCopyDirectory,
  onTheme,
}: WorkspaceCommandsProps) {
  return (
    <CommandGroup heading="Actions">
      <CommandItem value="new job add" onSelect={run(onAddJob)}>
        <Plus /> New job <CommandShortcut>N</CommandShortcut>
      </CommandItem>
      <CommandItem value="toggle sidebar" onSelect={run(toggleSidebar)}>
        <PanelLeft /> Toggle sidebar <CommandShortcut>{modKey}B</CommandShortcut>
      </CommandItem>
      <CommandItem value="check runtimes" onSelect={run(onCheckRuntimes)}>
        <RefreshCw /> Check installed runtimes
      </CommandItem>
      <CommandItem value="copy data folder path" onSelect={run(onCopyDirectory)}>
        <Copy /> Copy data folder path
      </CommandItem>
      {themeOptions.map((option) => (
        <CommandItem
          key={option.id}
          value={`theme ${option.label}`}
          onSelect={run(() => onTheme(option.id))}
        >
          <option.icon /> Theme: {option.label}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
