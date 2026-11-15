import type { Ref } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { useSidebar } from '@pitchcrew/design-system/sidebar';
import { NotificationBell } from '@/Notifications/index.tsx';
import { MobileOverflow } from './MobileOverflow.tsx';

type WorkspaceMobileBarProps = {
  title: string;
  primaryRef: Ref<HTMLDivElement>;
  titleRef?: Ref<HTMLDivElement>;
  onSearch: () => void;
  onAddJob: () => void;
};

/**
 * Phones replace the sidebar with a drawer. This 48px bar opens it, names the page, holds the
 * page's one primary action and ends in the overflow; the bell stands beside it only while no
 * primary takes its place.
 */
export const WorkspaceMobileBar = ({
  title,
  primaryRef,
  titleRef,
  onSearch,
  onAddJob,
}: WorkspaceMobileBarProps) => {
  const { isMobile, setOpenMobile } = useSidebar();
  if (!isMobile) return null;
  return (
    <div className="workspace-mobile-bar">
      <Button
        variant="ghost"
        size="icon"
        className="workspace-mobile-menu"
        aria-label="Open navigation"
        onClick={() => setOpenMobile(true)}
      >
        <Menu aria-hidden="true" />
      </Button>
      <div className="workspace-mobile-title-slot" ref={titleRef} />
      <span className="workspace-mobile-title" aria-hidden="true">
        {title}
      </span>
      <div className="workspace-mobile-primary" ref={primaryRef} />
      <NotificationBell className="workspace-mobile-bell" side="bottom" align="end" />
      <MobileOverflow onSearch={onSearch} onAddJob={onAddJob} />
    </div>
  );
};
