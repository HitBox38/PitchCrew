'use client';

import { Menu } from '@base-ui/react/menu';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useTheme, type ThemeChoice } from './hooks/useTheme';

const choices = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

export function Theme() {
  const { choice, select } = useTheme();
  const Icon = choices.find((item) => item.value === choice)?.icon ?? Monitor;
  return (
    <Menu.Root>
      <Menu.Trigger
        render={<Button variant="secondary" className="theme-trigger" />}
        aria-label={`Color theme: ${choice}`}
        title="Choose color theme"
      >
        <Icon size={19} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8} align="end" className="z-50">
          <Menu.Popup className="theme-menu">
            <Menu.RadioGroup
              value={choice}
              onValueChange={(value) => select(value as ThemeChoice)}
              aria-label="Color theme"
            >
              {choices.map(({ value, label, icon: OptionIcon }) => (
                <Menu.RadioItem key={value} value={value} closeOnClick className="theme-option">
                  <OptionIcon size={17} aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  <Menu.RadioItemIndicator>
                    <Check size={16} aria-hidden="true" />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
