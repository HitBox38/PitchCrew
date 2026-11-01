import { PanelLeft, Search, X } from 'lucide-react';
import type { SidebarStripProps } from '@/AppSidebar/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { SidebarHeader } from '@/components/ui/sidebar/components/SidebarHeader.tsx';
import { useSidebar } from '@/components/ui/sidebar/hooks/useSidebar.ts';
import { NotificationBell } from '@/Notifications/index.tsx';
import { modKey } from '@/shortcuts.ts';
import { NewMenu } from './NewMenu.tsx';
import { StripButton } from './StripButton.tsx';

/**
 * The 44px top strip: the window's own controls sit above it (native on desktop), then Hide
 * sidebar, Search, New and the notification bell. The phone drawer starts with its own 48px bar
 * instead (close and the app name): Search, New and the bell live in the page's top bar.
 */
export const SidebarStrip = ({ onSearch, onAddJob }: SidebarStripProps) => {
  const { state, isMobile, toggleSidebar, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;
  if (isMobile)
    return (
      <SidebarHeader className="sidebar-strip sidebar-drawer-bar">
        <Button
          variant="ghost"
          size="icon"
          className="sidebar-strip-button"
          aria-label="Close navigation"
          onClick={() => setOpenMobile(false)}
        >
          <X aria-hidden="true" />
        </Button>
        <span className="sidebar-drawer-title">Pitchcrew</span>
      </SidebarHeader>
    );
  return (
    <SidebarHeader className="sidebar-strip">
      <StripButton
        label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
        hint={`${modKey}\\`}
        onClick={toggleSidebar}
      >
        <PanelLeft aria-hidden="true" />
      </StripButton>
      <StripButton label="Search" hint={`${modKey}K`} onClick={onSearch}>
        <Search aria-hidden="true" />
      </StripButton>
      <NewMenu onAddJob={onAddJob} />
      <NotificationBell
        className="sidebar-strip-button"
        side={collapsed ? 'right' : 'bottom'}
        align="start"
      />
    </SidebarHeader>
  );
};
