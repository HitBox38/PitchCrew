import { settingsSections } from '../constants.ts';
import { TabsList } from '@/components/ui/tabs/components/TabsList.tsx';
import { TabsTrigger } from '@/components/ui/tabs/components/TabsTrigger.tsx';
import { useEffect, useRef } from 'react';
import { useSearch } from '@tanstack/react-router';
import { useIsMobile } from '@/hooks/use-mobile.ts';

export const SettingsTabs = () => {
  const { section } = useSearch({ from: '/settings' });
  const mobile = useIsMobile();
  const active = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (mobile) active.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [mobile, section]);
  return (
    <TabsList className="settings-tabs" aria-label="Settings sections" activateOnFocus>
      {settingsSections.map(({ id, label, description, icon: Icon }) => (
        <TabsTrigger key={id} value={id} ref={id === section ? active : undefined}>
          <Icon size={17} aria-hidden="true" />
          <span className="min-w-0 text-left">
            <span className="block">{label}</span>
            <span className="settings-tab-description" aria-hidden="true">
              {description}
            </span>
          </span>
        </TabsTrigger>
      ))}
    </TabsList>
  );
};
