import {
  useDevicePreferences,
  analyticsKey,
  diagnosticsKey,
  replayKey,
  updatesKey,
} from '@/lib/device-preferences.ts';
import { useChatPreferenceStore } from '@/ChatView/preferences.ts';

/** Device setters intentionally keep session state when storage fails; never call that Saved. */
export const persistedSetting = (control: HTMLElement): boolean => {
  const group = control.closest('[role="radiogroup"]');
  const id = control.closest('label')?.htmlFor || control.id;
  const preferences = useDevicePreferences.getState();
  try {
    if (group?.getAttribute('aria-labelledby') === 'appearance-heading')
      return (
        localStorage.getItem('pitchcrew-theme') ===
        (preferences.theme === 'system' ? null : preferences.theme)
      );
    if (group?.id === 'chat-reading-width')
      return (
        localStorage.getItem('pitchcrew.chat.width') ===
        JSON.stringify(useChatPreferenceStore.getState().width)
      );
    if (id === 'notification-sounds')
      return (
        localStorage.getItem('pitchcrew-notifications-preferences-v1') ===
        JSON.stringify({ sound: preferences.sound })
      );
    const keys: Record<string, [string, boolean]> = {
      'usage-analytics': [analyticsKey, preferences.analytics],
      'diagnostic-analytics': [diagnosticsKey, preferences.diagnostics],
      'session-replay': [replayKey, preferences.replay],
      'automatic-updates': [updatesKey, preferences.automaticUpdates],
    };
    const setting = keys[id];
    if (setting) return localStorage.getItem(setting[0]) === String(setting[1]);
    // Daemon controls commit from the confirmed snapshot, rather than optimistic local state.
    return true;
  } catch {
    return false;
  }
};
