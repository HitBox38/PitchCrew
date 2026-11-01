import { useEffect, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@pitchcrew/design-system/popover';
import { NotificationPanel } from '@/Notifications/components/NotificationPanel.tsx';
import { useNotificationItems } from '@/Notifications/hooks/useNotificationItems.ts';
import { useNotificationStore } from '@/Notifications/store.ts';
import { MobileOverflowMenu } from './MobileOverflowMenu.tsx';

/**
 * The phone top bar's overflow: Search, New and, when the page primary takes the bell's place,
 * Notifications, which opens the same panel inside this popover.
 */
export const MobileOverflow = ({
  onSearch,
  onAddJob,
}: {
  onSearch: () => void;
  onAddJob: () => void;
}) => {
  const { unread } = useNotificationItems();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'notifications'>('menu');
  const setPanelOpen = useNotificationStore((state) => state.setPanelOpen);
  useEffect(() => setPanelOpen(open && view === 'notifications'), [open, view, setPanelOpen]);
  useEffect(() => () => setPanelOpen(false), [setPanelOpen]);
  const change = (next: boolean) => {
    setOpen(next);
    if (!next) setView('menu');
  };
  return (
    <Popover open={open} onOpenChange={change}>
      <PopoverTrigger
        className="notification-bell workspace-mobile-overflow"
        aria-label={`More: search, new and notifications, ${unread.length} unread`}
        data-unread={unread.length ? '' : undefined}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
        {unread.length ? <span className="workspace-overflow-dot" aria-hidden="true" /> : null}
      </PopoverTrigger>
      <PopoverContent
        className={view === 'notifications' ? 'notification-panel' : 'workspace-overflow-menu'}
        side="bottom"
        align="end"
        sideOffset={4}
      >
        {view === 'notifications' ? (
          <NotificationPanel close={() => change(false)} />
        ) : (
          <MobileOverflowMenu
            unread={unread.length}
            close={() => change(false)}
            showNotifications={() => setView('notifications')}
            onSearch={onSearch}
            onAddJob={onAddJob}
          />
        )}
      </PopoverContent>
    </Popover>
  );
};
