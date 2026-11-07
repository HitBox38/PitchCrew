import type { SettingEntry } from './search.ts';

declare module '@tanstack/react-router' {
  interface HistoryState {
    settingsFocus?: string;
  }
}

/** Both search surfaces must reveal an unchanged URL again after manual panel changes. */
export const settingDestination = (entry: SettingEntry) => ({
  to: '/settings' as const,
  search: { section: entry.section },
  hash: entry.target,
  state: { settingsFocus: crypto.randomUUID() },
});
