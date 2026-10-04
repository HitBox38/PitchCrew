import { settingsSections } from '../constants.ts';
import { TabsList } from '@/components/ui/tabs/components/TabsList.tsx';
import { TabsTrigger } from '@/components/ui/tabs/components/TabsTrigger.tsx';

export function SettingsTabs() {
  return (
    <TabsList className="settings-tabs" aria-label="Settings sections" activateOnFocus>
      {settingsSections.map(({ id, label, icon: Icon }) => (
        <TabsTrigger key={id} value={id}>
          <Icon size={17} aria-hidden="true" /> {label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
