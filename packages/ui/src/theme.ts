import { useEffect, useState } from 'react';
export type ThemeChoice = 'system' | 'light' | 'dark';
// Keep in sync with public/theme.js, which applies the theme before the first paint.
const storageKey = 'pitchcrew-theme';
function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        choice === 'system' ? (media.matches ? 'dark' : 'light') : choice;
    };
    apply();
    try {
      if (choice === 'system') localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, choice);
    } catch {
      /* Storage can be unavailable; the choice still applies for this session. */
    }
    if (choice !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [choice]);
  return [choice, setChoice] as const;
}
