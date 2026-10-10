import { Button } from '@/components/ui/button/components/Button.tsx';
import { Checkbox } from '@/components/ui/checkbox/index.tsx';
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
    <div className="notification-controls form">
      <label className="checkbox-label" htmlFor="notification-panel-sounds">
        <Checkbox
          id="notification-panel-sounds"
          checked={preferences.sound}
          onCheckedChange={(sound) => onPreferences({ ...preferences, sound })}
        />
        Sounds
      </label>
      <Button className="button small" disabled={!unread} onClick={onReadAll}>
        Mark all read
      </Button>
    </div>
  );
}
