import { Switch } from '../../components/ui/switch/index.tsx';
import { useDevicePreferences } from '../../lib/device-preferences.ts';

export const DiagnosticSettings = () => {
  const allowed = useDevicePreferences((state) => state.analytics);
  const enabled = useDevicePreferences((state) => state.diagnostics);
  const setEnabled = useDevicePreferences((state) => state.setDiagnostics);
  return (
    <label className="settings-row" htmlFor="diagnostic-analytics">
      <span>
        <strong>Share anonymous diagnostics</strong>
        <span className="quiet block">
          Send content-free reliability and performance measurements. Requires usage analytics.
        </span>
      </span>
      <Switch
        id="diagnostic-analytics"
        aria-label="Share anonymous diagnostics"
        checked={allowed && enabled}
        disabled={!allowed}
        onCheckedChange={setEnabled}
      />
    </label>
  );
};
