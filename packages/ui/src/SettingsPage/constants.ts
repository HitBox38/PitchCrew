import { HardDrive, Link, SlidersHorizontal, Terminal } from 'lucide-react';

export const settingsSections = [
  { id: 'general', label: 'General', icon: SlidersHorizontal },
  { id: 'accounts', label: 'Accounts', icon: Link },
  { id: 'runtimes', label: 'Runtimes', icon: Terminal },
  { id: 'data', label: 'Local data', icon: HardDrive },
] as const;
