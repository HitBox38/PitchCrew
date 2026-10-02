import { Button } from '@/components/ui/button/components/Button.tsx';
import type { NotificationPreferences } from '../types.ts';

export function NotificationControls({
  preferences,
  onPreferences,
  unread,
  onReadAll,
}: {
  preferences: NotificationPreferences;
  onPreferences: (value: NotificationPreferences) => void;
  unread: number;
  onReadAll: () => void;
}) {
  return (
    <div className="notification-controls">
      <label>
        <input
          type="checkbox"
          checked={preferences.sound}
          onChange={(e) => onPreferences({ ...preferences, sound: e.target.checked })}
        />{' '}
        Sounds
      </label>
      <Button className="button" disabled={!unread} onClick={onReadAll}>
        Mark all read
      </Button>
    </div>
  );
}
