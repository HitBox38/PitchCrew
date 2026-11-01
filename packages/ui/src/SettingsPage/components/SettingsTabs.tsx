import { settingsSections } from '../constants.ts';
import { TabsList, TabsTrigger } from '@pitchcrew/design-system/tabs';
import { useEffect, useRef } from 'react';
import { useSearch } from '@tanstack/react-router';
import { SettingsSearch } from './SettingsSearch.tsx';

export const SettingsTabs = ({ compact }: { compact: boolean }) => {
  const { section } = useSearch({ from: '/settings' });
  const active = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!compact) return;
    const frame = requestAnimationFrame(() => {
      const target = active.current;
      const list = target?.closest<HTMLElement>('[role="tablist"]');
      if (!target || !list) return;
      list.scrollTo({
        left: target.offsetLeft - (list.clientWidth - target.offsetWidth) / 2,
        behavior: 'instant',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [compact, section]);
  return (
    <nav className="settings-navigation" aria-label="Settings">
      <SettingsSearch />
      <TabsList className="settings-tabs" aria-label="Settings sections" activateOnFocus>
        {settingsSections.map(({ id, label, description }) => (
          <TabsTrigger
            key={id}
            value={id}
            ref={id === section ? active : undefined}
            className="settings-tab"
          >
            <span className="settings-tab-label">{label}</span>
            <span className="settings-tab-description" aria-hidden="true">
              {description}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </nav>
  );
};
