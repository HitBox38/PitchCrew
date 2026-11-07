import { settingsSections } from '../constants.ts';
import { TabsList, TabsTrigger } from '@pitchcrew/design-system/tabs';
import { SettingsSearch } from './SettingsSearch.tsx';
import { SettingsPicker } from './SettingsPicker.tsx';

export const SettingsTabs = ({ compact }: { compact: boolean }) => {
  return (
    <nav className="settings-navigation" aria-label="Settings">
      <SettingsSearch />
      {compact ? (
        <SettingsPicker />
      ) : (
        <TabsList className="settings-tabs" aria-label="Settings sections">
          {settingsSections.map(({ id, label, icon: Icon, group }, index) => (
            <div key={id} className="settings-nav-item">
              {index === 0 || settingsSections[index - 1]?.group !== group ? (
                <span className="settings-nav-group">{group}</span>
              ) : null}
              <TabsTrigger value={id} className="settings-tab">
                <Icon size={16} aria-hidden="true" />
                <span className="settings-tab-label">{label}</span>
              </TabsTrigger>
            </div>
          ))}
        </TabsList>
      )}
    </nav>
  );
};
