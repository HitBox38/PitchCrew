import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  diagnosticsKey,
  synchronizeTelemetryPreferences,
  useDevicePreferences,
} from '../../../lib/device-preferences.ts';
import { useAnalyticsConfig } from '../../api.ts';
import { installOperationalLogs } from '../index.ts';

vi.mock('../../context.ts', () => ({
  analyticsContext: () => ({ app_version: '0.2.0', renderer: 'browser', analytics_schema: 2 }),
}));
const config = { token: 'phc_fixture_token', host: 'https://eu.i.posthog.com' };
const log = { code: 'http_request_failed', area: 'http' };
const preferences = useDevicePreferences.getState();
afterEach(() => {
  useDevicePreferences.setState(preferences);
  useAnalyticsConfig.setState({ config: null, loaded: false });
  vi.unstubAllGlobals();
});

describe('mounted operational Logs installer', () => {
  it('aborts immediately on a synchronized opt-out and removes listeners on disposal', async () => {
    const send = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_, reject) => {
          init!.signal!.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    vi.stubGlobal('fetch', send);
    useDevicePreferences.setState({ analytics: true, diagnostics: true });
    useAnalyticsConfig.setState({ config });
    const installed = installOperationalLogs({ getDistinctId: () => 'sdk-id' });
    const first = installed.capture('operational_log', log);
    expect(send).toHaveBeenCalledTimes(1);
    synchronizeTelemetryPreferences({ key: diagnosticsKey, newValue: 'false' });
    expect(send.mock.calls[0]![1]!.signal!.aborted).toBe(true);
    expect(await first).toBe(false);
    expect(await installed.capture('operational_log', log)).toBe(false);
    installed.dispose();
    useDevicePreferences.setState({ analytics: true, diagnostics: true });
    useAnalyticsConfig.setState({ config: { ...config } });
    expect(await installed.capture('operational_log', log)).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('requires loaded configuration and reacts to master opt-out on the same device', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', send);
    useDevicePreferences.setState({ analytics: true, diagnostics: true });
    useAnalyticsConfig.setState({ config: null });
    const installed = installOperationalLogs({ getDistinctId: () => 'sdk-id' });
    expect(await installed.capture('operational_log', log)).toBe(false);
    useAnalyticsConfig.setState({ config });
    expect(await installed.capture('operational_log', log)).toBe(true);
    useDevicePreferences.setState({ analytics: false });
    expect(await installed.capture('operational_log', log)).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    installed.dispose();
  });
});
