import { createPortal } from 'react-dom';
import { Link } from '@tanstack/react-router';
import { PanelLeft, Search, Settings } from 'lucide-react';
import type { Snapshot } from '@pitchcrew/core';
import { buttonVariants } from '@pitchcrew/design-system/button';
import { useSidebar } from '@pitchcrew/design-system/sidebar';
import { NewMenu } from '@/AppSidebar/components/NewMenu.tsx';
import { StripButton } from '@/AppSidebar/components/StripButton.tsx';
import { AppUpdates } from '@/AppUpdates/index.tsx';
import { NotificationBell } from '@/Notifications/index.tsx';
import { QueueWidget } from '@/QueueWidget/index.tsx';
import { modKey } from '@/shortcuts.ts';

/** Global controls share the native titlebar; browsers get the same compact app bar. */
export const WorkspaceAppBar = ({
  data,
  settingsActive,
  onSearch,
  onAddJob,
}: {
  data: Snapshot;
  settingsActive: boolean;
  onSearch: () => void;
  onAddJob: () => void;
}) => {
  const { state, isMobile, toggleSidebar } = useSidebar();
  const host = document.getElementById('workspace-app-bar-root');
  if (isMobile || !host) return null;
  return createPortal(
    <header className="workspace-app-bar" aria-label="Workspace controls">
      <div className="workspace-app-bar-tools">
        <StripButton
          label={state === 'collapsed' ? 'Show sidebar' : 'Hide sidebar'}
          hint={`${modKey}\\`}
          side="bottom"
          onClick={toggleSidebar}
        >
          <PanelLeft aria-hidden="true" />
        </StripButton>
        <StripButton label="Search" hint={`${modKey}K`} side="bottom" onClick={onSearch}>
          <Search aria-hidden="true" />
        </StripButton>
        <NewMenu onAddJob={onAddJob} side="bottom" />
        <NotificationBell className="sidebar-strip-button" side="bottom" align="start" />
      </div>
      <span className="workspace-app-bar-brand" aria-hidden="true">
        Pitchcrew
      </span>
      <div className="workspace-app-bar-status">
        <QueueWidget data={data} variant="bar" side="bottom" align="end" />
        <AppUpdates />
        <StripButton
          label="Settings"
          side="bottom"
          render={
            <Link
              to="/settings"
              search={{ section: 'general' }}
              className={buttonVariants({
                variant: 'ghost',
                size: 'icon-sm',
                className: 'sidebar-strip-button workspace-settings',
              })}
              aria-label="Settings"
              aria-current={settingsActive ? 'page' : undefined}
            />
          }
        >
          <Settings aria-hidden="true" />
        </StripButton>
      </div>
    </header>,
    host,
  );
};
