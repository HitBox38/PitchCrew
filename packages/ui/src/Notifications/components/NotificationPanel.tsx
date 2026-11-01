import { Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { PopoverClose, PopoverTitle } from '@/components/ui/popover/index.tsx';
import { Switch } from '@/components/ui/switch/index.tsx';
import { useDevicePreferences } from '@/lib/device-preferences.ts';
import { groupNotifications } from '../helpers.ts';
import { useNotificationItems } from '../hooks/useNotificationItems.ts';
import { useNotificationStore } from '../store.ts';
import { NotificationList } from './NotificationList.tsx';

export const NotificationPanel = ({ close }: { close: () => void }) => {
  const { items, read, unread } = useNotificationItems();
  const markRead = useNotificationStore((state) => state.markRead);
  const sound = useDevicePreferences((state) => state.sound);
  const setSound = useDevicePreferences((state) => state.setSound);
  return (
    <>
      <header className="notification-panel-heading">
        <PopoverTitle>Notifications</PopoverTitle>
        <button
          type="button"
          className="text-button"
          disabled={!unread.length}
          onClick={() => markRead(items.map((item) => item.id))}
        >
          Mark all read
        </button>
        <PopoverClose className="icon-button notification-panel-close" aria-label="Close">
          <X size={15} aria-hidden="true" />
        </PopoverClose>
      </header>
      <NotificationList groups={groupNotifications(items)} read={read} close={close} />
      <footer className="notification-panel-footer">
        <label htmlFor="notification-panel-sounds">
          <Switch id="notification-panel-sounds" checked={sound} onCheckedChange={setSound} />
          Sounds
        </label>
        <Link to="/activity" className="text-button" onClick={close}>
          Activity
        </Link>
      </footer>
    </>
  );
};
