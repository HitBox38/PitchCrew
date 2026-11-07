import { afterEach, expect, test, vi } from 'vitest';
import { persistedSetting } from '../persisted-setting.ts';
import { useDevicePreferences } from '@/lib/device-preferences.ts';

afterEach(() => vi.unstubAllGlobals());
const control = (id: string) => ({ id, closest: () => null }) as unknown as HTMLElement;

test('device confirmation compares committed store state with persisted bytes', () => {
  useDevicePreferences.setState({ sound: true });
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ sound: false }) });
  expect(persistedSetting(control('notification-sounds'))).toBe(false);
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ sound: true }) });
  expect(persistedSetting(control('notification-sounds'))).toBe(true);
});

test('unavailable storage does not claim durable device saves or block confirmed daemon preferences', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('Storage disabled');
    },
  });
  expect(persistedSetting(control('notification-sounds'))).toBe(false);
  expect(persistedSetting(control('writing-learning'))).toBe(true);
});
