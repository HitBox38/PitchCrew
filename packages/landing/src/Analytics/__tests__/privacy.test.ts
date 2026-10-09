import { describe, expect, it, vi } from 'vitest';
import { createAnalytics, sdkConfig } from '../client';
import { analyticsAllowed, preferenceKey, sanitizeEvent } from '../helpers';
import { parseRelease } from '../../Downloads/helpers';

const installer = parseRelease(null).installers[0];
const makeSdk = () => ({
  init: vi.fn(),
  capture: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
});

describe('landing analytics privacy', () => {
  it('drops unexpected events and removes URLs, referrers, personal text and arbitrary properties', () => {
    expect(sanitizeEvent({ event: '$autocapture', properties: {} })).toBeNull();
    const event = sanitizeEvent({
      event: 'landing_download_clicked',
      properties: {
        installer: 'linux-deb',
        destination: 'installer',
        platform: 'private text',
        $current_url: 'https://example.test/?private=value',
        $referrer: 'private',
        email: 'private',
      },
    });
    expect(event?.properties).toEqual({
      installer: 'linux-deb',
      platform: 'linux',
      destination: 'installer',
      $process_person_profile: false,
      $geoip_disable: true,
    });
    expect(
      sanitizeEvent({ event: 'landing_download_clicked', properties: { installer: 'custom' } }),
    ).toBeNull();
  });

  it('respects opt-out, Do Not Track and inaccessible preference storage', () => {
    const storage = { getItem: vi.fn(() => 'off') };
    expect(analyticsAllowed(storage, null)).toBe(false);
    expect(storage.getItem).toHaveBeenCalledWith(preferenceKey);
    storage.getItem.mockReturnValue('on');
    expect(analyticsAllowed(storage, '1')).toBe(false);
    expect(analyticsAllowed(storage, 'yes')).toBe(false);
    expect(analyticsAllowed(storage, null)).toBe(true);
    expect(
      analyticsAllowed(
        {
          getItem: () => {
            throw new Error('blocked');
          },
        },
        null,
      ),
    ).toBe(false);
  });

  it('does not initialize a pending SDK when the user opts out during import', async () => {
    const sdk = makeSdk();
    let resolve!: (value: typeof sdk) => void;
    const analytics = createAnalytics(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = analytics.setEnabled(true);
    await analytics.setEnabled(false);
    resolve(sdk);
    await pending;
    analytics.capture(installer);
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.capture).not.toHaveBeenCalled();
  });

  it('counts a page only once and immediately drops download events after opt-out', async () => {
    const sdk = makeSdk();
    const analytics = createAnalytics(async () => sdk);
    await analytics.setEnabled(true);
    await analytics.setEnabled(true);
    expect(sdk.capture).toHaveBeenCalledTimes(1);
    analytics.capture(installer);
    expect(sdk.capture).toHaveBeenCalledWith('landing_download_clicked', {
      installer: 'mac-arm64',
      destination: 'releases',
    });
    await analytics.setEnabled(false);
    analytics.capture(installer);
    expect(sdk.capture).toHaveBeenCalledTimes(2);
    const config = sdk.init.mock.calls[0][1];
    expect(config.before_send({ event: 'landing_page_viewed', properties: {} })).toBeNull();
  });

  it('contains failures and does not queue disabled or failed events', async () => {
    const analytics = createAnalytics(async () => {
      throw new Error('SDK unavailable');
    });
    await expect(analytics.setEnabled(true)).resolves.toBeUndefined();
    expect(() => analytics.capture(installer)).not.toThrow();
    expect(sdkConfig).toMatchObject({
      autocapture: false,
      disable_session_recording: true,
      person_profiles: 'never',
      persistence: 'memory',
    });
  });
});
