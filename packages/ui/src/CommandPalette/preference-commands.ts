import type { LucideIcon } from 'lucide-react';
import { Compass, Copy, Download, PanelLeft, RefreshCw } from 'lucide-react';
import { SIDEBAR_KEYBOARD_SHORTCUT } from '@pitchcrew/design-system/sidebar';
import { themeOptions } from '@/lib/theme-options.ts';
import { modKey } from '@/shortcuts.ts';
import type { SettingsCommandsProps } from './types.ts';

export type PreferenceCommand = {
  value: string;
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  action: () => void;
};

/** Appearance, sidebar, runtime, data and update commands, listed under Settings in the palette. */
export const preferenceCommands = (props: SettingsCommandsProps): PreferenceCommand[] => [
  ...themeOptions.map((option) => ({
    value: `theme ${option.label}`,
    icon: option.icon,
    label: `Set theme: ${option.label}`,
    action: () => props.onTheme(option.id),
  })),
  {
    value: 'toggle sidebar hide show',
    icon: PanelLeft,
    label: 'Toggle sidebar',
    shortcut: `${modKey}${SIDEBAR_KEYBOARD_SHORTCUT.toUpperCase()}`,
    action: props.toggleSidebar,
  },
  {
    value: 'check installed runtimes',
    icon: RefreshCw,
    label: 'Check installed runtimes',
    action: props.onCheckRuntimes,
  },
  {
    value: 'copy data folder path',
    icon: Copy,
    label: 'Copy data folder path',
    action: props.onCopyDirectory,
  },
  {
    value: 'check for updates pitchcrew',
    icon: Download,
    label: 'Check for updates',
    action: props.onCheckUpdates,
  },
  ...(props.onShowIntroduction
    ? [
        {
          value: 'show introduction getting started onboarding',
          icon: Compass,
          label: 'Show introduction',
          action: props.onShowIntroduction,
        },
      ]
    : []),
];
