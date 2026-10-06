import { useDevicePreferences } from '@/lib/device-preferences.ts';
import { Switch } from '@/components/ui/switch/index.tsx';

export function NotificationSettings() {
  const sound = useDevicePreferences((state) => state.sound);
  const setSound = useDevicePreferences((state) => state.setSound);
  return (
    <section className="settings-section" aria-labelledby="notification-heading">
      <h2 id="notification-heading">Notifications</h2>
      <p className="quiet">Your crew alerts you to new messages and requests for attention.</p>
      <label
        className="settings-row"
        htmlFor="notification-sounds"
        aria-label="Notification sounds"
      >
        <span>
          <strong>Notification sounds</strong>
          <span className="quiet block">Play a sound when a message or request arrives.</span>
        </span>
        <Switch
          id="notification-sounds"
          aria-label="Notification sounds"
          checked={sound}
          onCheckedChange={setSound}
        />
      </label>
      <p className="info-note">Preferences save automatically on this device.</p>
    </section>
  );
}
