import type { ThemeChoice } from '@/theme.ts';
import { create } from 'zustand';

const themeKey = 'pitchcrew-theme';
const soundKey = 'pitchcrew-notifications-preferences-v1';
export const analyticsKey = 'pitchcrew-analytics-enabled-v1';
export const diagnosticsKey = 'pitchcrew-diagnostics-enabled-v1';
export const replayKey = 'pitchcrew-replay-enabled-v1';
export const updatesKey = 'pitchcrew-automatic-updates-v1';

function readAutomaticUpdates(): boolean {
  try {
    return localStorage.getItem(updatesKey) !== 'false';
  } catch {
    return true;
  }
}

function readTelemetryPreference(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
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
  diagnostics: boolean;
  replay: boolean;
  setDiagnostics: (enabled: boolean) => void;
  setReplay: (enabled: boolean) => void;
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
  diagnostics: readTelemetryPreference(diagnosticsKey, true),
  replay: readTelemetryPreference(replayKey, false),
  setDiagnostics: (diagnostics) => {
    set({ diagnostics });
    persistTelemetryPreference(diagnosticsKey, diagnostics);
  },
  setReplay: (replay) => {
    set({ replay });
    persistTelemetryPreference(replayKey, replay);
  },
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

function persistTelemetryPreference(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* Consent still applies for this session when storage is unavailable. */
  }
}

/** Update consent synchronously on storage events without writing back to another tab. */
export function synchronizeTelemetryPreferences(event: Pick<StorageEvent, 'key' | 'newValue'>) {
  const keys: Record<string, 'analytics' | 'diagnostics' | 'replay'> = {
    [analyticsKey]: 'analytics',
    [diagnosticsKey]: 'diagnostics',
    [replayKey]: 'replay',
  };
  if (event.key === null) {
    useDevicePreferences.setState({ analytics: true, diagnostics: true, replay: false });
    return;
  }
  const preference = keys[event.key];
  if (!preference) return;
  const fallback = preference !== 'replay';
  useDevicePreferences.setState({
    [preference]: event.newValue === null ? fallback : event.newValue === 'true',
  });
}
