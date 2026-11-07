import { ReplaySettings } from './ReplaySettings.tsx';
import { DiagnosticSettings } from './DiagnosticSettings.tsx';
import { Switch } from '@pitchcrew/design-system/switch';
import { useDevicePreferences } from '../../lib/device-preferences.ts';
import { useAnalyticsConfig } from '../api.ts';
import { SettingsSection } from '@/SettingsPage/components/SettingsSection.tsx';
import { SettingRow } from '@/SettingsPage/components/SettingRow.tsx';

export const AnalyticsSettings = () => {
  const enabled = useDevicePreferences((state) => state.analytics);
  const setEnabled = useDevicePreferences((state) => state.setAnalytics);
  const configured = useAnalyticsConfig((state) => !!state.config);
  const loaded = useAnalyticsConfig((state) => state.loaded);
  return (
    <SettingsSection
      id="analytics-heading"
      title="Usage analytics"
      scope="This device"
      description="When sharing is enabled, anonymous page visits and feature usage go to PostHog. Profile notes, messages, job content and packets stay out of analytics. Session replay requires a separate opt-in."
    >
      <p className="settings-callout">
        {!loaded
          ? 'Checking analytics availability…'
          : configured
            ? 'Usage analytics is available in this installation.'
            : 'Analytics is unavailable in this installation. No usage data is sent. These switches keep your preferences for when analytics is available.'}
      </p>
      <div className="settings-list settings-preferences">
        <SettingRow id="usage-analytics" title="Share anonymous usage">
          <Switch
            id="usage-analytics"
            aria-labelledby="usage-analytics-label"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </SettingRow>
        <DiagnosticSettings />
        <ReplaySettings />
      </div>
    </SettingsSection>
  );
};
