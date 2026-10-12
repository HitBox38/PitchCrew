import { Switch } from '../../components/ui/switch/index.tsx';
import { useDevicePreferences } from '../../lib/device-preferences.ts';

export function ReplaySettings() {
  const allowed = useDevicePreferences((state) => state.analytics);
  const enabled = useDevicePreferences((state) => state.replay);
  const setEnabled = useDevicePreferences((state) => state.setReplay);
  return (
    <label className="settings-row" htmlFor="session-replay">
      <span>
        <strong>Share masked session replay</strong>
        <span className="quiet block">
          Optional wireframe recordings of navigation and layout. All text and inputs are hidden.
          Off by default.
        </span>
      </span>
      <Switch
        id="session-replay"
        aria-label="Share masked session replay"
        checked={allowed && enabled}
        disabled={!allowed}
        onCheckedChange={setEnabled}
      />
    </label>
  );
}
