import { useDevicePreferences } from '@/lib/device-preferences.ts';
import { Switch } from '@pitchcrew/design-system/switch';
import { SettingsSection } from './SettingsSection.tsx';
import { SettingRow } from './SettingRow.tsx';

export const NotificationSettings = () => {
  const sound = useDevicePreferences((state) => state.sound);
  const setSound = useDevicePreferences((state) => state.setSound);
  return (
    <SettingsSection id="notification-heading" title="Notifications">
      <SettingRow
        id="notification-sounds"
        title="Notification sounds"
        description="Play a sound when a message or request arrives."
      >
        <Switch
          id="notification-sounds"
          aria-labelledby="notification-sounds-label"
          aria-describedby="notification-sounds-description"
          checked={sound}
          onCheckedChange={setSound}
        />
      </SettingRow>
    </SettingsSection>
  );
};
