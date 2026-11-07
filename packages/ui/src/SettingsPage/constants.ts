import {
  HardDrive,
  Link,
  ListChecks,
  Radar,
  RefreshCw,
  Shield,
  SlidersHorizontal,
  Terminal,
  PenLine,
} from 'lucide-react';

export const settingsSections = [
  {
    id: 'general',
    label: 'General',
    icon: SlidersHorizontal,
    group: 'Preferences',
    scope: 'Appearance, chat and sounds save on this device.',
  },
  {
    id: 'writing',
    label: 'Writing',
    icon: PenLine,
    group: 'Preferences',
    scope: 'Writing preferences and detector keys belong to this workspace.',
  },
  {
    id: 'rules',
    label: 'Packet rules',
    icon: ListChecks,
    group: 'Preferences',
    scope: 'Applies to this workspace. Edits take effect when you save rules.',
  },
  {
    id: 'accounts',
    label: 'Accounts',
    icon: Link,
    group: 'Connections',
    scope:
      'Connections are saved on the computer running Pitchcrew. Agent permissions stay separate.',
  },
  {
    id: 'sources',
    label: 'Job sources',
    icon: Radar,
    group: 'Connections',
    scope: 'Sources are shared by this workspace. Editing a source requires Save.',
  },
  {
    id: 'runtimes',
    label: 'Runtimes',
    icon: Terminal,
    group: 'Connections',
    scope: 'Sign-in stays with each CLI. Choose an agent’s runtime and model in Crew.',
  },
  {
    id: 'updates',
    label: 'Updates',
    icon: RefreshCw,
    group: 'System',
    scope: 'App checks are a device preference. Agent and skill checks apply to this workspace.',
  },
  {
    id: 'privacy',
    label: 'Privacy',
    icon: Shield,
    group: 'System',
    scope: 'Consent applies to this browser or desktop app. Changes apply immediately.',
  },
  {
    id: 'data',
    label: 'Local data',
    icon: HardDrive,
    group: 'System',
    scope: 'This workspace is stored on the computer running Pitchcrew.',
  },
] as const;
