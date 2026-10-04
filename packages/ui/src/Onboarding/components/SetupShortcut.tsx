import { Compass } from 'lucide-react';
import { SidebarMenuButton } from '@/components/ui/sidebar/components/SidebarMenuButton.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { useOnboarding } from '../hooks/useOnboarding.ts';

export function SetupShortcut() {
  const { data, working, save } = useOnboarding();
  if (!data?.onboarding) return null;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip="Getting started"
        disabled={working}
        onClick={() => void save('welcome', 0)}
      >
        <Compass />
        <span>Getting started</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
