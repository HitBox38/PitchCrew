import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover/index.tsx';
import { cn } from '@/lib/utils';
import { useNotificationItems } from '../hooks/useNotificationItems.ts';
import { useNotificationStore } from '../store.ts';
import { NotificationPanel } from './NotificationPanel.tsx';

/**
 * The bell and its panel. Every mounted bell shares read state; each opens its own panel beside
 * itself (below in the sidebar strip, to the right in the rail).
 */
export const NotificationBell = ({
  side = 'bottom',
  align = 'start',
  className,
}: {
  side?: 'bottom' | 'right' | 'top' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
}) => {
  const { unread } = useNotificationItems();
  const [open, setOpen] = useState(false);
  const setPanelOpen = useNotificationStore((state) => state.setPanelOpen);
  const change = (value: boolean) => {
    setOpen(value);
    setPanelOpen(value);
  };
  useEffect(() => () => setPanelOpen(false), [setPanelOpen]);
  return (
    <Popover open={open} onOpenChange={change}>
      <PopoverTrigger
        className={cn('notification-bell', className)}
        aria-label={`Notifications, ${unread.length} unread`}
        data-unread={unread.length ? '' : undefined}
      >
        <Bell size={16} aria-hidden="true" />
        {unread.length ? (
          <span className="notification-count" aria-hidden="true">
            {unread.length > 99 ? '99+' : unread.length}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent className="notification-panel" side={side} align={align} sideOffset={8}>
        <NotificationPanel close={() => change(false)} />
      </PopoverContent>
    </Popover>
  );
};
