import { themeOptions } from '@/lib/theme-options.ts';
import { useDevicePreferences } from '@/lib/device-preferences.ts';
import { Check } from 'lucide-react';

export function AppearanceSettings() {
  const theme = useDevicePreferences((state) => state.theme);
  const setTheme = useDevicePreferences((state) => state.setTheme);
  return (
    <section className="settings-section" aria-labelledby="appearance-heading">
      <h2 id="appearance-heading">Appearance</h2>
      <p className="quiet">Choose how Pitchcrew looks on this device.</p>
      <fieldset className="settings-themes">
        <legend className="sr-only">Theme</legend>
        {themeOptions.map(({ id, label, icon: Icon }) => (
          <label className="settings-theme" key={id}>
            <input
              type="radio"
              name="theme"
              value={id}
              checked={theme === id}
              onChange={() => setTheme(id)}
            />
            <span className={`settings-theme-preview settings-theme-${id}`} aria-hidden="true">
              <span className="settings-preview-sidebar" />
              <span className="settings-preview-board">
                <i />
                <i />
                <i />
              </span>
            </span>
            <span className="flex items-center gap-2">
              <Icon size={16} aria-hidden="true" />
              {label}
              {theme === id ? <Check className="ml-auto" size={16} aria-hidden="true" /> : null}
            </span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
