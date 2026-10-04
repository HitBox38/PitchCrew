import { SidebarFooter } from '@/components/ui/sidebar/components/SidebarFooter.tsx';
import { SidebarMenu } from '@/components/ui/sidebar/components/SidebarMenu.tsx';
import { SidebarMenuButton } from '@/components/ui/sidebar/components/SidebarMenuButton.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { Link } from '@tanstack/react-router';
import { Settings } from 'lucide-react';

export function SettingsLink({ active }: { active: boolean }) {
  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Settings"
            isActive={active}
            aria-current={active ? 'page' : undefined}
            render={<Link to="/settings" search={{ section: 'general' }} />}
          >
            <Settings />
            <span>Settings</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}
