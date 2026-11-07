import { RadioGroup } from '@base-ui/react/radio-group';
import { Radio } from '@base-ui/react/radio';
import { Check } from 'lucide-react';
import { themeOptions } from '@/lib/theme-options.ts';
import { useDevicePreferences } from '@/lib/device-preferences.ts';
import { SettingsSection } from './SettingsSection.tsx';

export const AppearanceSettings = () => {
  const theme = useDevicePreferences((state) => state.theme);
  const setTheme = useDevicePreferences((state) => state.setTheme);
  return (
    <SettingsSection id="appearance-heading" title="Appearance" scope="This device" autosave>
      <RadioGroup
        className="settings-themes"
        aria-labelledby="appearance-heading"
        value={theme}
        onValueChange={(value) => setTheme(value as typeof theme)}
      >
        {themeOptions.map(({ id, label }) => (
          <Radio.Root key={id} value={id} className="settings-theme">
            <span className={`settings-theme-preview settings-theme-${id}`} aria-hidden="true">
              <span className="settings-preview-sidebar" />
              <span className="settings-preview-board">
                <i />
                <i />
                <i />
              </span>
              <Radio.Indicator className="settings-theme-check">
                <Check size={12} strokeWidth={3} />
              </Radio.Indicator>
            </span>
            <span className="settings-theme-label">{label}</span>
          </Radio.Root>
        ))}
      </RadioGroup>
    </SettingsSection>
  );
};
