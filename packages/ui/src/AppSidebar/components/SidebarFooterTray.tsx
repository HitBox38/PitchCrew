import type { Snapshot } from '@pitchcrew/core';
import { Link } from '@tanstack/react-router';
import { Settings } from 'lucide-react';
import { AppUpdates } from '@/AppUpdates/index.tsx';
import { buttonVariants } from '@/components/ui/button/constants.ts';
import { SourceActivity } from '@/components/ProfileSources/components/SourceActivity.tsx';
import { SidebarFooter } from '@/components/ui/sidebar/components/SidebarFooter.tsx';
import { useSidebar } from '@/components/ui/sidebar/hooks/useSidebar.ts';
import { QueueWidget } from '@/QueueWidget/index.tsx';
import { SetupRow } from './SetupRow.tsx';
import { StripButton } from './StripButton.tsx';

/**
 * Conditional rows (setup, profile-source activity, app update) above the recessed slot tray:
 * the queue button with its sockets, and a separate Settings gear.
 */
export const SidebarFooterTray = ({ data, active }: { data: Snapshot; active: boolean }) => {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const rail = state === 'collapsed' && !isMobile;
  return (
    <SidebarFooter className="sidebar-footer">
      <SetupRow />
      <div className="sidebar-source-activity" onClickCapture={() => setOpenMobile(false)}>
        <SourceActivity />
      </div>
      <AppUpdates />
      <div className="sidebar-tray">
        <QueueWidget data={data} variant={rail ? 'rail' : 'tray'} className="sidebar-tray-queue" />
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
