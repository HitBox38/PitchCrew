import { viewIcons, viewTitles, workspaceViews } from '@/AppSidebar/constants.ts';
import type { WorkspaceLinksProps } from '@/AppSidebar/types.ts';
import { Collapsible } from '@/components/ui/collapsible/components/Collapsible.tsx';
import { CollapsibleContent } from '@/components/ui/collapsible/components/CollapsibleContent.tsx';
import { CollapsibleTrigger } from '@/components/ui/collapsible/components/CollapsibleTrigger.tsx';
import { SidebarGroup } from '@/components/ui/sidebar/components/SidebarGroup.tsx';
import { SidebarGroupContent } from '@/components/ui/sidebar/components/SidebarGroupContent.tsx';
import { SidebarGroupLabel } from '@/components/ui/sidebar/components/SidebarGroupLabel.tsx';
import { SidebarMenu } from '@/components/ui/sidebar/components/SidebarMenu.tsx';
import { SidebarMenuAction } from '@/components/ui/sidebar/components/SidebarMenuAction.tsx';
import { SidebarMenuBadge } from '@/components/ui/sidebar/components/SidebarMenuBadge.tsx';
import { SidebarMenuButton } from '@/components/ui/sidebar/components/SidebarMenuButton.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { SidebarMenuSub } from '@/components/ui/sidebar/components/SidebarMenuSub.tsx';
import { SidebarMenuSubButton } from '@/components/ui/sidebar/components/SidebarMenuSubButton.tsx';
import { SidebarMenuSubItem } from '@/components/ui/sidebar/components/SidebarMenuSubItem.tsx';
import { viewPaths } from '@/navigation.ts';
import { Link } from '@tanstack/react-router';
import { ChevronRight, LayoutDashboard } from 'lucide-react';

export function WorkspaceLinks({ view, stages, onStage, counts }: WorkspaceLinksProps) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Workspace</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <Collapsible className="group/collapsible" render={<SidebarMenuItem />}>
            <SidebarMenuButton
              tooltip="Board"
              isActive={view === 'board'}
              aria-current={view === 'board' ? 'page' : undefined}
              render={<Link to="/" />}
            >
              <LayoutDashboard />
              <span>Board</span>
            </SidebarMenuButton>
            <CollapsibleTrigger
              render={
                <SidebarMenuAction className="stage-toggle" aria-label="Show pipeline stages" />
              }
            >
              <ChevronRight />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {stages.map((stage) => (
                  <SidebarMenuSubItem key={stage.id}>
                    <SidebarMenuSubButton
                      render={(props) => <button type="button" {...props} />}
                      className={`stage-link ${stage.color}`}
                      onClick={() => onStage(stage.id)}
                    >
                      <span className="stage-dot" aria-hidden="true" />
                      <span>{stage.label}</span>
                      <span className="stage-count">{stage.count}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
          {workspaceViews.map((id) => {
            const Icon = viewIcons[id];
            const count = counts[id] ?? 0;
            return (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton
                  tooltip={count ? `${viewTitles[id]} (${count})` : viewTitles[id]}
                  isActive={view === id}
                  aria-current={view === id ? 'page' : undefined}
                  render={<Link to={viewPaths[id]} />}
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
  );
}
