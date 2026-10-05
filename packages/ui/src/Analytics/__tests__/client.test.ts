import { describe, expect, it, vi } from 'vitest';
import { createAnalytics, sdkConfig } from '../client.ts';

const config = { token: 'phc_fixture123', host: 'https://eu.i.posthog.com' };
function sdkMock() {
  return { init: vi.fn(), capture: vi.fn(), opt_in_capturing: vi.fn(), opt_out_capturing: vi.fn() };
}

describe('analytics lifecycle', () => {
  it('does not load the SDK without a configured project or after opting out', async () => {
    const load = vi.fn();
    const analytics = createAnalytics(load);
    await analytics.setEnabled(true, null);
    await analytics.setEnabled(false, config);
    analytics.capture('job_created');
    expect(load).not.toHaveBeenCalled();
  });

  it('cancels initialization when consent changes during the lazy import', async () => {
    const sdk = sdkMock();
    let resolve!: (value: typeof sdk) => void;
    const analytics = createAnalytics(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const starting = analytics.setEnabled(true, config);
    await analytics.setEnabled(false, config);
    resolve(sdk);
    expect(await starting).toBe(false);
    expect(sdk.init).not.toHaveBeenCalled();
    analytics.capture('chat_sent');
    expect(sdk.capture).not.toHaveBeenCalled();
  });

  it('initializes once, deduplicates pages, stops immediately and allows re-enabling', async () => {
    const sdk = sdkMock();
    let consent = true;
    const analytics = createAnalytics(
      async () => sdk,
      () => consent,
    );
    await analytics.setEnabled(true, config);
    expect(sdk.init).toHaveBeenCalledWith(
      config.token,
      expect.objectContaining({
        ...sdkConfig,
        api_host: config.host,
        before_send: expect.any(Function),
      }),
    );
    analytics.capture('$pageview', { page: 'board' });
    analytics.capture('$pageview', { page: 'board' });
    analytics.capture('$pageview', { page: 'profile' });
    expect(sdk.capture).toHaveBeenCalledTimes(2);
    consent = false;
    analytics.capture('job_created');
    expect(sdk.capture).toHaveBeenCalledTimes(2);
    await analytics.setEnabled(false, config);
    expect(sdk.opt_out_capturing).toHaveBeenCalledOnce();
    consent = true;
    await analytics.setEnabled(true, config);
    analytics.capture('$pageview', { page: 'profile' });
    expect(sdk.init).toHaveBeenCalledOnce();
    expect(sdk.capture).toHaveBeenCalledTimes(3);
  });

  it('rechecks the preference before initialization even before the React effect catches up', async () => {
    const sdk = sdkMock();
    let consent = true;
    let resolve!: (value: typeof sdk) => void;
    const analytics = createAnalytics(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
      () => consent,
    );
    const starting = analytics.setEnabled(true, config);
    consent = false;
    resolve(sdk);
    expect(await starting).toBe(false);
    expect(sdk.init).not.toHaveBeenCalled();
  });

  it('keeps SDK failures outside application actions and supports a later retry', async () => {
    const sdk = sdkMock();
    const load = vi.fn().mockRejectedValueOnce(new Error('Blocked')).mockResolvedValue(sdk);
    const analytics = createAnalytics(load);
    expect(await analytics.setEnabled(true, config)).toBe(false);
    expect(await analytics.setEnabled(true, config)).toBe(true);
    sdk.capture.mockImplementation(() => {
      throw new Error('Offline');
    });
    expect(() => analytics.capture('profile_saved')).not.toThrow();
  });
});
