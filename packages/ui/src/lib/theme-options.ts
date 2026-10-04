import { Monitor, Moon, Sun } from 'lucide-react';

export const themeOptions = [
  { id: 'system', label: 'Match system', icon: Monitor },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
] as const;
