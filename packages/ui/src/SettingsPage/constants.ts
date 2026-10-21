import {
  HardDrive,
  Link,
  ListChecks,
  Radar,
  RefreshCw,
  Shield,
  SlidersHorizontal,
  Terminal,
} from 'lucide-react';

export const settingsSections = [
  {
    id: 'general',
    label: 'General',
    description: 'Appearance and notifications',
    icon: SlidersHorizontal,
  },
  { id: 'accounts', label: 'Accounts', description: 'Services and external agents', icon: Link },
  { id: 'sources', label: 'Job sources', description: 'Boards your crew watches', icon: Radar },
  { id: 'runtimes', label: 'Runtimes', description: 'CLI setup and updates', icon: Terminal },
  { id: 'writing', label: 'Writing', description: 'Your shared writing guide', icon: ListChecks },
  { id: 'rules', label: 'Packet rules', description: 'Checks before export', icon: ListChecks },
  { id: 'updates', label: 'Updates', description: 'Pitchcrew, agents and skills', icon: RefreshCw },
  { id: 'privacy', label: 'Privacy', description: 'Usage data and diagnostics', icon: Shield },
  {
    id: 'data',
    label: 'Local data',
    description: 'Storage and background service',
    icon: HardDrive,
  },
] as const;
