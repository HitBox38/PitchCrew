import type { ThemeChoice } from '@/theme.ts';
import { create } from 'zustand';

const themeKey = 'pitchcrew-theme';
const soundKey = 'pitchcrew-notifications-preferences-v1';
export const analyticsKey = 'pitchcrew-analytics-enabled-v1';
export const updatesKey = 'pitchcrew-automatic-updates-v1';

function readAutomaticUpdates(): boolean {
  try {
    return localStorage.getItem(updatesKey) !== 'false';
  } catch {
    return true;
  }
}

function readAnalytics(): boolean {
  try {
    return localStorage.getItem(analyticsKey) !== 'false';
  } catch {
    return true;
  }
}

function readTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(themeKey);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function readSound(): boolean {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(soundKey) ?? 'null');
    return !!value &&
      typeof value === 'object' &&
      'sound' in value &&
      typeof value.sound === 'boolean'
      ? value.sound
      : true;
  } catch {
    return true;
  }
}

interface DevicePreferences {
  theme: ThemeChoice;
  sound: boolean;
  analytics: boolean;
  automaticUpdates: boolean;
  setAutomaticUpdates: (enabled: boolean) => void;
  setTheme: (theme: ThemeChoice) => void;
  setSound: (sound: boolean) => void;
  setAnalytics: (analytics: boolean) => void;
}

// Keep the existing storage keys so upgrading preserves the user's choices.
export const useDevicePreferences = create<DevicePreferences>((set) => ({
  theme: readTheme(),
  sound: readSound(),
  analytics: readAnalytics(),
  automaticUpdates: readAutomaticUpdates(),
  setAutomaticUpdates: (automaticUpdates) => {
    set({ automaticUpdates });
    try {
      localStorage.setItem(updatesKey, String(automaticUpdates));
    } catch {
      /* The preference still applies for this session. */
    }
  },
  setAnalytics: (analytics) => {
    set({ analytics });
    try {
      localStorage.setItem(analyticsKey, String(analytics));
    } catch {
      /* Consent still applies for this session when storage is unavailable. */
    }
  },
  setTheme: (theme) => {
    set({ theme });
    try {
      if (theme === 'system') localStorage.removeItem(themeKey);
      else localStorage.setItem(themeKey, theme);
    } catch {
      /* Preferences still apply for this session when storage is unavailable. */
    }
  },
  setSound: (sound) => {
    set({ sound });
    try {
      localStorage.setItem(soundKey, JSON.stringify({ sound }));
    } catch {
      /* Preferences still apply for this session when storage is unavailable. */
    }
  },
}));
