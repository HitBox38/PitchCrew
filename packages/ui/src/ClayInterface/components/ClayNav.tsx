import { Link } from '@tanstack/react-router';
import { FileUser, Inbox, LayoutDashboard, Users } from 'lucide-react';
import type { WorkspaceLinksProps } from '@/AppSidebar/types.ts';
import { SidebarCategory } from '@/AppSidebar/components/SidebarCategory.tsx';
import { WorkspaceNavLink } from '@/AppSidebar/components/WorkspaceNavLink.tsx';
import { SidebarGroup } from '@/components/ui/sidebar/components/SidebarGroup.tsx';
import { SidebarGroupContent } from '@/components/ui/sidebar/components/SidebarGroupContent.tsx';
import { SidebarMenu } from '@/components/ui/sidebar/components/SidebarMenu.tsx';
import { SidebarMenuBadge } from '@/components/ui/sidebar/components/SidebarMenuBadge.tsx';
import { SidebarMenuButton } from '@/components/ui/sidebar/components/SidebarMenuButton.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { primaryViews, secondaryViews } from '../constants.ts';

const icons = { board: LayoutDashboard, inbox: Inbox, crew: Users, profile: FileUser };

export const ClayNav = ({ view, counts }: Pick<WorkspaceLinksProps, 'view' | 'counts'>) => (
  <SidebarGroup>
    <SidebarGroupContent>
      <SidebarMenu>
        {primaryViews.map(({ id, label, path }) => {
          const Icon = icons[id];
          const count = counts[id] ?? 0;
          return (
            <SidebarMenuItem key={id}>
              <SidebarMenuButton
                tooltip={label}
                isActive={view === id}
                aria-current={view === id ? 'page' : undefined}
                render={<Link to={path} />}
              >
                <Icon />
                <span>{label}</span>
              </SidebarMenuButton>
              {count ? (
                <SidebarMenuBadge className={id === 'inbox' ? 'attention' : undefined}>
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

export const ClayMore = ({ view, counts }: Pick<WorkspaceLinksProps, 'view' | 'counts'>) => (
  <SidebarCategory id="clay-more" label="More">
    <SidebarGroupContent>
      <SidebarMenu>
        {secondaryViews.map((id) => (
          <WorkspaceNavLink key={id} id={id} view={view} count={counts[id] ?? 0} />
        ))}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarCategory>
);
