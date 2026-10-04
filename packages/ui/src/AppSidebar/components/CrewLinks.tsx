import type { CrewLinksProps } from '@/AppSidebar/types.ts';
import { SidebarCategory } from '@/AppSidebar/components/SidebarCategory.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { DropdownMenu } from '@/components/ui/dropdown-menu/components/DropdownMenu.tsx';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu/components/DropdownMenuContent.tsx';
import { DropdownMenuGroup } from '@/components/ui/dropdown-menu/components/DropdownMenuGroup.tsx';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu/components/DropdownMenuItem.tsx';
import { DropdownMenuLabel } from '@/components/ui/dropdown-menu/components/DropdownMenuLabel.tsx';
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu/components/DropdownMenuTrigger.tsx';
import { SidebarGroupContent } from '@/components/ui/sidebar/components/SidebarGroupContent.tsx';
import { SidebarMenu } from '@/components/ui/sidebar/components/SidebarMenu.tsx';
import { SidebarMenuAction } from '@/components/ui/sidebar/components/SidebarMenuAction.tsx';
import { SidebarMenuButton } from '@/components/ui/sidebar/components/SidebarMenuButton.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { Link } from '@tanstack/react-router';
import {
  LoaderCircle,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Play,
  SlidersHorizontal,
} from 'lucide-react';

export function CrewLinks({
  roles,
  runningRoles,
  roleStatus,
  onChatRole,
  onConfigureRole,
  working,
  onToggleRole,
}: CrewLinksProps) {
  return (
    <SidebarCategory id="crew" label="Crew">
      <SidebarGroupContent>
        <SidebarMenu>
          {roles
            .filter((role) => !role.retiredAt)
            .map((role) => {
              const running = runningRoles.includes(role.id);
              return (
                <SidebarMenuItem key={role.id}>
                  <SidebarMenuButton
                    size="lg"
                    className={`crew-button ${role.enabled ? '' : 'paused'}`}
                    tooltip={`${role.name}: ${roleStatus(role)}`}
                    render={<Link to="/chat/$thread" params={{ thread: role.id }} />}
                  >
                    <RoleAvatar agentRole={role.id} size="small" />
                    <span className="crew-text">
                      <strong>{role.name}</strong>
                      <small>{roleStatus(role)}</small>
                    </span>
                    {running ? (
                      <LoaderCircle
                        className="spin crew-running ml-auto text-primary"
                        aria-label="Running"
                      />
                    ) : null}
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<SidebarMenuAction aria-label={`${role.name} actions`} />}
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="menu">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>{role.name}</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onChatRole(role.id)}>
                          <MessageSquare /> Chat
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onConfigureRole(role.id)}>
                          <SlidersHorizontal /> Configure…
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={working || running}
                          onClick={() => onToggleRole(role)}
                        >
                          {role.enabled ? <Pause /> : <Play />}
                          {role.enabled ? 'Pause role' : 'Resume role'}
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              );
            })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarCategory>
  );
}
