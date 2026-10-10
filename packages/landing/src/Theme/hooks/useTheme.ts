'use client';

import { useSyncExternalStore } from 'react';
import { themeEvent, themeKey } from '../constants';

export type ThemeChoice = 'light' | 'dark' | 'system';
const parse = (value: string | null | undefined): ThemeChoice =>
  value === 'light' || value === 'dark' ? value : 'system';
const snapshot = () => parse(document.documentElement.dataset.themeChoice);
const serverSnapshot = (): ThemeChoice => 'system';

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  const dark =
    choice === 'dark' ||
    (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.themeChoice = choice;
  root.dataset.theme = dark ? 'dark' : 'light';
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', dark ? '#1a1b1e' : '#f2f1ec');
  });
}

function subscribe(notify: () => void) {
  const media = matchMedia('(prefers-color-scheme: dark)');
  const sync = () => {
    apply(snapshot());
    notify();
  };
  const storage = (event: StorageEvent) => {
    if (event.key === themeKey || event.key === null) {
      apply(parse(event.newValue));
      notify();
    }
  };
  sync();
  media.addEventListener('change', sync);
  window.addEventListener('storage', storage);
  window.addEventListener(themeEvent, sync);
  return () => {
    media.removeEventListener('change', sync);
    window.removeEventListener('storage', storage);
    window.removeEventListener(themeEvent, sync);
  };
}

export function useTheme() {
  const choice = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const select = (value: ThemeChoice) => {
    apply(value);
    try {
      if (value === 'system') localStorage.removeItem(themeKey);
      else localStorage.setItem(themeKey, value);
    } catch {
      /* The choice still applies for this visit. */
    }
    window.dispatchEvent(new Event(themeEvent));
  };
  return { choice, select };
}
