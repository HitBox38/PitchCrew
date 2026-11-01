import { AppearanceSettings } from './AppearanceSettings.tsx';
import { ChatReadingWidth } from './ChatReadingWidth.tsx';
import { IntroductionSetting } from './IntroductionSetting.tsx';
import { NotificationSettings } from './NotificationSettings.tsx';

export const GeneralSettings = () => (
  <>
    <AppearanceSettings />
    <ChatReadingWidth />
    <NotificationSettings />
    <IntroductionSetting />
  </>
);
