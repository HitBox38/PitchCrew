import { Copy, PanelLeft, Plus, RefreshCw, SlidersHorizontal, MessageSquare } from 'lucide-react';
import type { Card, Role, RoleId } from '@pitchcrew/core';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './components/ui/command.tsx';
import { useSidebar } from './components/ui/sidebar.tsx';
import { CompanyMark, stateLabels } from './components.tsx';
import { themeOptions, viewIcons, viewTitles, type View } from './app-sidebar.tsx';
import { modKey } from './shortcuts.ts';
import type { ThemeChoice } from './theme.ts';

export function CommandPalette({
  open,
  onOpenChange,
  cards,
  roles,
  onNavigate,
  onOpenCard,
  onConfigureRole,
  onChatRole,
  onAddJob,
  onCheckRuntimes,
  onTheme,
  onCopyDirectory,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: Card[];
  roles: Role[];
  onNavigate: (view: View) => void;
  onOpenCard: (id: string) => void;
  onConfigureRole: (id: RoleId) => void;
  onChatRole: (id: RoleId) => void;
  onAddJob: () => void;
  onCheckRuntimes: () => void;
  onTheme: (theme: ThemeChoice) => void;
  onCopyDirectory: () => void;
}) {
  const { toggleSidebar } = useSidebar();
  const run = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };
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
        <CommandGroup heading="Go to">
          {(Object.keys(viewTitles) as View[]).map((id) => {
            const Icon = viewIcons[id];
            return (
              <CommandItem
                key={id}
                value={`go ${viewTitles[id]}`}
                onSelect={run(() => onNavigate(id))}
              >
                <Icon /> {viewTitles[id]}
              </CommandItem>
            );
          })}
        </CommandGroup>
        {cards.length ? (
          <CommandGroup heading="Jobs">
            {cards.map((card) => (
              <CommandItem
                key={card.id}
                value={`${card.title} ${card.company} ${card.location} ${card.tags.join(' ')} ${card.id}`}
                onSelect={run(() => onOpenCard(card.id))}
              >
                <CompanyMark name={card.company} />
                <span className="command-job">
                  {card.title} <small>{card.company}</small>
                </span>
                <CommandShortcut>{stateLabels[card.state]}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        <CommandGroup heading="Crew">
          {roles.map((role) => (
            <div key={role.id}>
              <CommandItem
                value={`chat talk ${role.name}`}
                onSelect={run(() => onChatRole(role.id))}
              >
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
        <CommandSeparator />
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
      </CommandList>
    </CommandDialog>
  );
}
