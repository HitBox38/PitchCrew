import { Switch } from '@pitchcrew/design-system/switch';
import { useDevicePreferences } from '../../lib/device-preferences.ts';

export const DiagnosticSettings = () => {
  const allowed = useDevicePreferences((state) => state.analytics);
  const enabled = useDevicePreferences((state) => state.diagnostics);
  const setEnabled = useDevicePreferences((state) => state.setDiagnostics);
  return (
    <label className="settings-row" htmlFor="diagnostic-analytics">
      <span>
        <strong>Share diagnostics</strong>
        <span className="quiet block">
          Send reliability measurements and agent-written bug or missing-capability reports to
          PostHog, including expected and actual behavior. Reports should omit private content;
          common identifiers are redacted. Requires usage analytics.
        </span>
      </span>
      <Switch
        id="diagnostic-analytics"
        aria-label="Share diagnostics"
        checked={allowed && enabled}
        disabled={!allowed}
        onCheckedChange={setEnabled}
      />
    </label>
  );
};
