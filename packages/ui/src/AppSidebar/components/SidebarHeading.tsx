import type { SidebarHeadingProps } from '@/AppSidebar/types.ts';
import { Kbd } from '@/components/ui/kbd/components/Kbd.tsx';
import { SidebarHeader } from '@/components/ui/sidebar/components/SidebarHeader.tsx';
import { SidebarMenu } from '@/components/ui/sidebar/components/SidebarMenu.tsx';
import { SidebarMenuButton } from '@/components/ui/sidebar/components/SidebarMenuButton.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { modKey } from '@/shortcuts.ts';
import { Link } from '@tanstack/react-router';
import { Plus, Search } from 'lucide-react';

export function SidebarHeading({ onSearch, onAddJob }: SidebarHeadingProps) {
  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="brand-button"
            tooltip="Board"
            render={<Link to="/" />}
          >
            <span className="brand-mark" aria-hidden="true">
              <img src="/favicon.svg" width="32" height="32" alt="" />
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
  );
}
