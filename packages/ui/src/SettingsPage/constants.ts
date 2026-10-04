import { HardDrive, Link, Radar, SlidersHorizontal, Terminal } from 'lucide-react';

export const settingsSections = [
  { id: 'general', label: 'General', icon: SlidersHorizontal },
  { id: 'accounts', label: 'Accounts', icon: Link },
  { id: 'sources', label: 'Job sources', icon: Radar },
  { id: 'runtimes', label: 'Runtimes', icon: Terminal },
  { id: 'data', label: 'Local data', icon: HardDrive },
] as const;
