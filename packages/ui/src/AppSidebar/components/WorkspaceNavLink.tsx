import { Link } from '@tanstack/react-router';
import { viewPaths } from '@/navigation.ts';
import { viewIcons, viewTitles, type workspaceViews } from '../constants.ts';
import type { View } from '@/navigation.ts';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { SidebarMenuButton } from '@/components/ui/sidebar/components/SidebarMenuButton.tsx';
import { SidebarMenuBadge } from '@/components/ui/sidebar/components/SidebarMenuBadge.tsx';

export const WorkspaceNavLink = ({
  id,
  view,
  count,
}: {
  id: (typeof workspaceViews)[number];
  view?: View;
  count: number;
}) => {
  const Icon = viewIcons[id];
  const updates = id === 'crew' || id === 'skills';
  const label = count
    ? `${viewTitles[id]} (${count}${updates ? (count === 1 ? ' update' : ' updates') : ''})`
    : viewTitles[id];
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        data-replay-surface={id}
        tooltip={label}
        aria-label={label}
        isActive={view === id}
        aria-current={view === id ? 'page' : undefined}
        render={<Link to={viewPaths[id]} />}
      >
        <Icon />
        <span>{viewTitles[id]}</span>
      </SidebarMenuButton>
      {count ? (
        <SidebarMenuBadge
          className={`${id === 'inbox' || updates ? 'attention' : ''} ${updates ? 'sidebar-update-badge' : ''}`}
        >
          {count}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  );
};
