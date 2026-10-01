import {
  Activity,
  ChevronRight,
  Copy,
  FileUser,
  Inbox,
  LayoutDashboard,
  LoaderCircle,
  Monitor,
  Moon,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Sun,
  Users,
} from 'lucide-react';
import type { Card, Role, RoleId } from '@pitchcrew/core';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from './components/ui/sidebar.tsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './components/ui/collapsible.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu.tsx';
import { Kbd } from './components/ui/kbd.tsx';
import { CompanyMark, RoleAvatar } from './components.tsx';
import type { ThemeChoice } from './theme.ts';
import { modKey } from './shortcuts.ts';

export type View = 'board' | 'crew' | 'inbox' | 'profile' | 'activity';
export const viewIcons = {
  board: LayoutDashboard,
  crew: Users,
  inbox: Inbox,
  profile: FileUser,
  activity: Activity,
};
export const viewTitles: Record<View, string> = {
  board: 'Board',
  crew: 'Crew',
  inbox: 'Inbox',
  profile: 'Profile',
  activity: 'Activity',
};
export const themeOptions = [
  { id: 'system', label: 'Match system', icon: Monitor },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
] as const;
export interface StageLink {
  id: string;
  label: string;
  color: string;
  count: number;
}
export function AppSidebar({
  view,
  onNavigate,
  stages,
  onStage,
  counts,
  roles,
  roleStatus,
  runningRoles,
  onConfigureRole,
  onToggleRole,
  recent,
  onOpenCard,
  onSearch,
  onAddJob,
  theme,
  onTheme,
  dataDirectory,
  onCopyDirectory,
  working,
}: {
  view: View;
  onNavigate: (view: View) => void;
  stages: StageLink[];
  onStage: (id: string) => void;
  counts: Partial<Record<View, number>>;
  roles: Role[];
  roleStatus: (role: Role) => string;
  runningRoles: RoleId[];
  onConfigureRole: (id: RoleId) => void;
  onToggleRole: (role: Role) => void;
  recent: Card[];
  onOpenCard: (id: string) => void;
  onSearch: () => void;
  onAddJob: () => void;
  theme: ThemeChoice;
  onTheme: (theme: ThemeChoice) => void;
  dataDirectory: string;
  onCopyDirectory: () => void;
  working: boolean;
}) {
  const ThemeIcon = themeOptions.find((option) => option.id === theme)!.icon;
  return (
    <Sidebar collapsible="icon" aria-label="Sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="brand-button"
              tooltip="Board"
              onClick={() => onNavigate('board')}
            >
              <span className="brand-mark" aria-hidden="true">
                <svg viewBox="0 0 40 40">
                  <rect width="40" height="40" rx="11" fill="currentColor" />
                  <path d="M12 29V12h9a8 8 0 0 1 0 16h-3v-6h3a2 2 0 0 0 0-4h-3v11z" fill="white" />
                </svg>
              </span>
              <span className="brand-text">
                <strong>pitchcrew</strong>
                <small>Local workspace</small>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={`Search (${modKey}K)`} onClick={onSearch}>
              <Search />
              <span>Search</span>
              <Kbd className="menu-kbd">{modKey}K</Kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="New job (N)" onClick={onAddJob}>
              <Plus />
              <span>New job</span>
              <Kbd className="menu-kbd">N</Kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible asChild defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Board"
                    isActive={view === 'board'}
                    aria-current={view === 'board' ? 'page' : undefined}
                    onClick={() => onNavigate('board')}
                  >
                    <LayoutDashboard />
                    <span>Board</span>
                  </SidebarMenuButton>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuAction className="stage-toggle" aria-label="Show pipeline stages">
                      <ChevronRight />
                    </SidebarMenuAction>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {stages.map((stage) => (
                        <SidebarMenuSubItem key={stage.id}>
                          <SidebarMenuSubButton asChild>
                            <button
                              type="button"
                              className={`stage-link ${stage.color}`}
                              onClick={() => onStage(stage.id)}
                            >
                              <span className="stage-dot" aria-hidden="true" />
                              <span>{stage.label}</span>
                              <span className="stage-count">{stage.count}</span>
                            </button>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
              {(['crew', 'inbox', 'profile', 'activity'] as const).map((id) => {
                const Icon = viewIcons[id];
                const count = counts[id] ?? 0;
                return (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      tooltip={count ? `${viewTitles[id]} (${count})` : viewTitles[id]}
                      isActive={view === id}
                      aria-current={view === id ? 'page' : undefined}
                      onClick={() => onNavigate(id)}
                    >
                      <Icon />
                      <span>{viewTitles[id]}</span>
                    </SidebarMenuButton>
                    {count ? (
                      <SidebarMenuBadge className={id === 'inbox' ? 'attention' : ''}>
                        {count}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Crew</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {roles.map((role) => {
                const running = runningRoles.includes(role.id);
                return (
                  <SidebarMenuItem key={role.id}>
                    <SidebarMenuButton
                      size="lg"
                      className={`crew-button ${role.enabled ? '' : 'paused'}`}
                      tooltip={`${role.name}: ${roleStatus(role)}`}
                      onClick={() => onConfigureRole(role.id)}
                    >
                      <RoleAvatar agentRole={role.id} size="small" />
                      <span className="crew-text">
                        <strong>{role.name}</strong>
                        <small>{roleStatus(role)}</small>
                      </span>
                      {running ? (
                        <LoaderCircle className="spin crew-running" aria-label="Running" />
                      ) : null}
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction aria-label={`${role.name} actions`}>
                          <MoreHorizontal />
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" className="menu">
                        <DropdownMenuLabel>{role.name}</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => onConfigureRole(role.id)}>
                          <SlidersHorizontal /> Configure…
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={working || running}
                          onSelect={() => onToggleRole(role)}
                        >
                          {role.enabled ? <Pause /> : <Play />}
                          {role.enabled ? 'Pause role' : 'Resume role'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {recent.length ? (
          <SidebarGroup className="recent-group">
            <SidebarGroupLabel>Recently opened</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {recent.map((card) => (
                  <SidebarMenuItem key={card.id}>
                    <SidebarMenuButton
                      tooltip={`${card.title} at ${card.company}`}
                      onClick={() => onOpenCard(card.id)}
                    >
                      <CompanyMark name={card.company} />
                      <span className="recent-text">
                        {card.title}
                        <small> · {card.company}</small>
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton tooltip="Theme">
                  <ThemeIcon />
                  <span>Theme</span>
                  <span className="menu-value">
                    {themeOptions.find((option) => option.id === theme)!.label}
                  </span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="menu">
                <DropdownMenuLabel>Theme</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={theme}
                  onValueChange={(value) => onTheme(value as ThemeChoice)}
                >
                  {themeOptions.map((option) => (
                    <DropdownMenuRadioItem key={option.id} value={option.id}>
                      <option.icon /> {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-button" tooltip="Data folder">
                  <span className="local-dot" aria-hidden="true" />
                  <span className="data-text">
                    <strong>Saved on this device</strong>
                    <code>
                      <bdi>{dataDirectory}</bdi>
                    </code>
                  </span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="menu data-menu">
                <DropdownMenuLabel>Data folder</DropdownMenuLabel>
                <p className="data-path">{dataDirectory}</p>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onCopyDirectory}>
                  <Copy /> Copy path
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
