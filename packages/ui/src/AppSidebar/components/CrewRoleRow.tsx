import type { Role } from '@pitchcrew/core';
import { Ellipsis, MessageSquare, Pause, Play, SlidersHorizontal } from 'lucide-react';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu/index.tsx';
import { SidebarMenuAction } from '@/components/ui/sidebar/components/SidebarMenuAction.tsx';
import { SidebarMenuButton } from '@/components/ui/sidebar/components/SidebarMenuButton.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { useSidebar } from '@/components/ui/sidebar/hooks/useSidebar.ts';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';

type CrewRoleRowProps = {
  role: Role;
  status: string;
  running: boolean;
  asking: boolean;
  working: boolean;
  onConfigure: () => void;
  onToggle: () => void;
};

/** One agent: opens its chat; the menu offers Chat, Configure and Pause or Resume. */
export const CrewRoleRow = ({ role, status, running, asking, ...actions }: CrewRoleRowProps) => {
  const { openChat } = useWorkspaceNavigation();
  const { setOpenMobile } = useSidebar();
  const chat = () => {
    setOpenMobile(false);
    void openChat(role.id);
  };
  return (
    <SidebarMenuItem className="sidebar-crew-item">
      <SidebarMenuButton
        className="sidebar-crew-row"
        data-paused={role.enabled ? undefined : ''}
        aria-label={`${role.name}, ${asking ? 'waiting for you' : status}`}
        onClick={chat}
      >
        <RoleAvatar agentRole={role.id} size="small" />
        <span className="sidebar-row-text">
          {role.name}
          <span className="sidebar-row-meta"> {asking ? 'Waiting for you' : status}</span>
        </span>
        {running ? (
          <StatusBead status="running" />
        ) : asking ? (
          <StatusBead status="waiting" />
        ) : null}
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuAction
              className="sidebar-row-menu"
              aria-label={`Actions for ${role.name}`}
            />
          }
        >
          <Ellipsis />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={chat}>
              <MessageSquare /> Chat
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setOpenMobile(false);
                actions.onConfigure();
              }}
            >
              <SlidersHorizontal /> Configure…
            </DropdownMenuItem>
            <DropdownMenuItem disabled={actions.working || running} onClick={actions.onToggle}>
              {role.enabled ? <Pause /> : <Play />}
              {role.enabled ? 'Pause role' : 'Resume role'}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};
