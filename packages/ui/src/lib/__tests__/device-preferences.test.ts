import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function storage(values: Record<string, string> = {}) {
  const entries = new Map(Object.entries(values));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  });
  return entries;
}

describe('shared device preferences', () => {
  it('preserves existing theme and sound choices and saves subsequent changes', async () => {
    const entries = storage({
      'pitchcrew-theme': 'dark',
      'pitchcrew-notifications-preferences-v1': '{"sound":false}',
    });
    const { useDevicePreferences } = await import('../device-preferences.ts');
    expect(useDevicePreferences.getState()).toMatchObject({ theme: 'dark', sound: false });
    const listener = vi.fn();
    const unsubscribe = useDevicePreferences.subscribe(listener);
    useDevicePreferences.getState().setTheme('light');
    useDevicePreferences.getState().setSound(true);
    expect(entries.get('pitchcrew-theme')).toBe('light');
    expect(JSON.parse(entries.get('pitchcrew-notifications-preferences-v1')!)).toEqual({
      sound: true,
    });
    expect(listener).toHaveBeenCalledTimes(2);
    useDevicePreferences.getState().setTheme('system');
    expect(entries.has('pitchcrew-theme')).toBe(false);
    unsubscribe();
  });

  it.each(['broken JSON', '{"sound":"false"}', 'null'])(
    'uses defaults when preferences contain %s',
    async (sound) => {
      storage({ 'pitchcrew-theme': 'invalid', 'pitchcrew-notifications-preferences-v1': sound });
      const { useDevicePreferences } = await import('../device-preferences.ts');
      expect(useDevicePreferences.getState()).toMatchObject({ theme: 'system', sound: true });
    },
  );

  it('keeps controls functional when storage is blocked', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('Storage blocked');
      },
      setItem: () => {
        throw new Error('Storage blocked');
      },
      removeItem: () => {
        throw new Error('Storage blocked');
      },
    });
    const { useDevicePreferences } = await import('../device-preferences.ts');
    useDevicePreferences.getState().setTheme('dark');
    useDevicePreferences.getState().setSound(false);
    expect(useDevicePreferences.getState()).toMatchObject({ theme: 'dark', sound: false });
    useDevicePreferences.getState().setTheme('system');
    expect(useDevicePreferences.getState().theme).toBe('system');
  });
});
