import { Compass } from 'lucide-react';
import { SidebarIconButton } from '@/components/ui/sidebar/components/SidebarIconButton.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { useOnboarding } from '../hooks/useOnboarding.ts';

export const SetupShortcut = () => {
  const { data, working, save } = useOnboarding();
  if (!data?.onboarding) return null;
  return (
    <SidebarMenuItem className="shrink-0">
      <SidebarIconButton
        label="Getting started"
        disabled={working}
        onClick={() => void save('welcome', 0)}
      >
        <Compass aria-hidden="true" />
      </SidebarIconButton>
    </SidebarMenuItem>
  );
};
