import { settingsSections } from '../constants.ts';
import { TabsList } from '@/components/ui/tabs/components/TabsList.tsx';
import { TabsTrigger } from '@/components/ui/tabs/components/TabsTrigger.tsx';
import { useEffect, useRef } from 'react';
import { useSearch } from '@tanstack/react-router';
import { useIsMobile } from '@/hooks/use-mobile.ts';
import { SettingsSearch } from './SettingsSearch.tsx';

export const SettingsTabs = () => {
  const { section } = useSearch({ from: '/settings' });
  const mobile = useIsMobile();
  const active = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobile) return;
    const frame = requestAnimationFrame(() => {
      const target = active.current;
      const list = target?.closest<HTMLElement>('[role="tablist"]');
      if (!target || !list) return;
      const box = target.getBoundingClientRect();
      const bounds = list.getBoundingClientRect();
      list.scrollTo({
        left: list.scrollLeft + box.left - bounds.left - (list.clientWidth - box.width) / 2,
        behavior: 'instant',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [mobile, section]);
  return (
    <div className="settings-navigation">
      <SettingsSearch />
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
    </div>
  );
};
