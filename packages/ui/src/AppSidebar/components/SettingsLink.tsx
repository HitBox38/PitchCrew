import { SetupShortcut } from '@/Onboarding/components/SetupShortcut.tsx';
import { AppUpdates } from '@/AppUpdates/index.tsx';
import { SidebarFooter } from '@/components/ui/sidebar/components/SidebarFooter.tsx';
import { SidebarMenu } from '@/components/ui/sidebar/components/SidebarMenu.tsx';
import { SidebarMenuButton } from '@/components/ui/sidebar/components/SidebarMenuButton.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { Link } from '@tanstack/react-router';
import { Settings } from 'lucide-react';
import { useRef } from 'react';

export function SettingsLink({ active }: { active: boolean }) {
  const settingsLink = useRef<HTMLAnchorElement>(null);
  return (
    <SidebarFooter>
      <SidebarMenu>
        <SetupShortcut />
        <AppUpdates fallbackFocus={settingsLink} />
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Settings"
            isActive={active}
            aria-current={active ? 'page' : undefined}
            render={<Link ref={settingsLink} to="/settings" search={{ section: 'general' }} />}
          >
            <Settings />
            <span>Settings</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}
