import type { Snapshot } from '@pitchcrew/core';
import { Link } from '@tanstack/react-router';
import { Settings } from 'lucide-react';
import { AppUpdates } from '@/AppUpdates/index.tsx';
import { buttonVariants } from '@pitchcrew/design-system/button';
import { SidebarFooter, useSidebar } from '@pitchcrew/design-system/sidebar';
import { QueueWidget } from '@/QueueWidget/index.tsx';
import { StripButton } from './StripButton.tsx';

/**
 * Phones keep queue and Settings in their navigation drawer. Desktop uses the app bar.
 */
export const SidebarFooterTray = ({ data, active }: { data: Snapshot; active: boolean }) => {
  const { isMobile, setOpenMobile } = useSidebar();
  if (!isMobile) return null;
  return (
    <SidebarFooter className="sidebar-footer">
      <div className="sidebar-tray">
        <QueueWidget data={data} variant="tray" className="sidebar-tray-queue" />
        <AppUpdates />
        <StripButton
          label="Settings"
          render={
            <Link
              to="/settings"
              search={{ section: 'general' }}
              className={buttonVariants({
                variant: 'ghost',
                size: 'icon-sm',
                className: 'sidebar-strip-button sidebar-settings',
              })}
              aria-label="Settings"
              aria-current={active ? 'page' : undefined}
              onClick={() => setOpenMobile(false)}
            />
          }
        >
          <Settings aria-hidden="true" />
        </StripButton>
      </div>
    </SidebarFooter>
  );
};
