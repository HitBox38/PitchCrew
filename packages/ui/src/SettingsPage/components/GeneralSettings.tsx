import { AppearanceSettings } from './AppearanceSettings.tsx';
import { ChatReadingWidth } from './ChatReadingWidth.tsx';
import { IntroductionSetting } from './IntroductionSetting.tsx';
import { NotificationSettings } from './NotificationSettings.tsx';

export const GeneralSettings = () => (
  <div className="settings-general">
    <AppearanceSettings />
    <div className="settings-list settings-preferences" aria-label="Preferences on this device">
      <ChatReadingWidth />
      <NotificationSettings />
    </div>
    <IntroductionSetting />
  </div>
);
