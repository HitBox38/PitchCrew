import { HardDrive, Link, ListChecks, SlidersHorizontal, Terminal } from 'lucide-react';

export const settingsSections = [
  { id: 'general', label: 'General', icon: SlidersHorizontal },
  { id: 'accounts', label: 'Accounts', icon: Link },
  { id: 'runtimes', label: 'Runtimes', icon: Terminal },
  { id: 'rules', label: 'Packet rules', icon: ListChecks },
  { id: 'data', label: 'Local data', icon: HardDrive },
] as const;
