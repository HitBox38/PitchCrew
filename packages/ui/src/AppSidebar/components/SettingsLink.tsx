import { SetupShortcut } from '@/Onboarding/components/SetupShortcut.tsx';
import { AppUpdates } from '@/AppUpdates/index.tsx';
import { SidebarFooter } from '@/components/ui/sidebar/components/SidebarFooter.tsx';
import { SidebarMenu } from '@/components/ui/sidebar/components/SidebarMenu.tsx';
import { SidebarIconButton } from '@/components/ui/sidebar/components/SidebarIconButton.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { Link } from '@tanstack/react-router';
import { Settings } from 'lucide-react';

export function SettingsLink({ active }: { active: boolean }) {
  return (
    <SidebarFooter>
      <SidebarMenu className="flex-row items-center group-data-[collapsible=icon]:flex-col">
        <SidebarMenuItem className="shrink-0">
          <SidebarIconButton
            label="Settings"
            isActive={active}
            aria-current={active ? 'page' : undefined}
            render={<Link to="/settings" search={{ section: 'general' }} />}
          >
            <Settings aria-hidden="true" />
          </SidebarIconButton>
        </SidebarMenuItem>
        <SetupShortcut />
        <AppUpdates />
      </SidebarMenu>
    </SidebarFooter>
  );
}
