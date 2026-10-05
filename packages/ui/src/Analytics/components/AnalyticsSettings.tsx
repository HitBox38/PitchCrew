import { Checkbox } from '../../components/ui/checkbox/index.tsx';
import { useDevicePreferences } from '../../lib/device-preferences.ts';
import { useAnalyticsConfig } from '../api.ts';

export function AnalyticsSettings() {
  const enabled = useDevicePreferences((state) => state.analytics);
  const setEnabled = useDevicePreferences((state) => state.setAnalytics);
  const configured = useAnalyticsConfig((state) => !!state.config);
  const loaded = useAnalyticsConfig((state) => state.loaded);
  return (
    <section className="settings-section" aria-labelledby="analytics-heading">
      <h2 id="analytics-heading">Usage analytics</h2>
      <p className="quiet">
        Help improve Pitchcrew with anonymous page visits and feature usage sent to PostHog. Profile
        notes, messages, job content and packets stay out of analytics. Sessions are never recorded.
      </p>
      <label className="settings-row" htmlFor="usage-analytics" aria-label="Share anonymous usage">
        <span>
          <strong>Share anonymous usage</strong>
          <span className="quiet block">Optional. You can turn this off at any time.</span>
        </span>
        <div className="flex shrink-0">
          <Checkbox
            id="usage-analytics"
            aria-label="Share anonymous usage"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
      </label>
      <p className="info-note">
        {!loaded
          ? 'Checking analytics availability…'
          : configured
            ? 'Your choice saves automatically for this browser or desktop app.'
            : 'Analytics is unavailable in this installation. No usage data is sent.'}
      </p>
    </section>
  );
}
