import { useDevicePreferences } from '@/lib/device-preferences.ts';
import { useEffect } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
// Keep in sync with public/theme.js, which applies the theme before the first paint.
export function useTheme() {
  const choice = useDevicePreferences((state) => state.theme);
  const setChoice = useDevicePreferences((state) => state.setTheme);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        choice === 'system' ? (media.matches ? 'dark' : 'light') : choice;
    };
    apply();
    if (choice !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [choice]);
  return [choice, setChoice] as const;
}
