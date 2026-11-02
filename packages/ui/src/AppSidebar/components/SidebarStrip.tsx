import { X } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { SidebarHeader, useSidebar } from '@pitchcrew/design-system/sidebar';

/**
 * The phone drawer's close button and app name. Global desktop controls live in the app bar.
 */
export const SidebarStrip = () => {
  const { isMobile, setOpenMobile } = useSidebar();
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
  return null;
};
