import { Switch } from '@pitchcrew/design-system/switch';
import { useDevicePreferences } from '../../lib/device-preferences.ts';
import { SettingRow } from '@/SettingsPage/components/SettingRow.tsx';

export const ReplaySettings = () => {
  const allowed = useDevicePreferences((state) => state.analytics);
  const enabled = useDevicePreferences((state) => state.replay);
  const setEnabled = useDevicePreferences((state) => state.setReplay);
  return (
    <SettingRow
      id="session-replay"
      title="Share masked session replay"
      description="Wireframe recordings of navigation and layout. All text and inputs are hidden. Off by default. Requires usage analytics."
    >
      <Switch
        id="session-replay"
        aria-labelledby="session-replay-label"
        aria-describedby="session-replay-description"
        checked={allowed && enabled}
        disabled={!allowed}
        onCheckedChange={setEnabled}
      />
    </SettingRow>
  );
};
