import { describe, expect, it, vi } from 'vitest';
import { createAnalytics, sdkConfig } from '../client';
import { sanitizeEvent } from '../helpers';

const anonymousId = '019a019a-019a-7000-8000-019a019a019a';
const makeSdk = () => ({
  init: vi.fn(),
  set_config: vi.fn(),
  capture: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
});

describe('native landing web analytics', () => {
  it('keeps generated session identifiers while fixing the public path and removing attribution', () => {
    const event = sanitizeEvent({
      event: '$pageleave',
      properties: {
        $session_id: anonymousId,
        $window_id: anonymousId,
        $pageview_id: anonymousId,
        $pathname: '/private',
        $host: 'private.test',
        $current_url: 'https://private.test/?email=secret',
        $session_entry_url: 'private',
        $referrer: 'private',
        $prev_pageview_duration: 12.5,
        utm_campaign: 'private',
      },
    });
    expect(event?.properties).toMatchObject({
      $session_id: anonymousId,
      $window_id: anonymousId,
      $pageview_id: anonymousId,
      $pathname: '/',
      $host: 'pitch-crew.tomer-norman.dev',
      $prev_pageview_duration: 12.5,
    });
    for (const field of ['$current_url', '$session_entry_url', '$referrer', 'utm_campaign'])
      expect(event?.properties).not.toHaveProperty(field);
    expect(sdkConfig.capture_pageleave).toBe(true);
    expect(sdkConfig.save_referrer).toBe(false);
    expect(sdkConfig.save_campaign_params).toBe(false);
  });

  it('accepts numeric vitals only, excluding performance entries and rejecting invalid values', () => {
    const clean = sanitizeEvent({
      event: '$web_vitals',
      properties: {
        $web_vitals_LCP_value: 2300,
        $web_vitals_CLS_value: 0.07,
        $web_vitals_INP_value: Number.NaN,
        $web_vitals_LCP_event: { entries: [{ url: 'private', element: 'secret' }] },
        entries: ['private'],
        attribution: 'secret',
      },
    });
    expect(clean?.properties).toHaveProperty('$web_vitals_LCP_value', 2300);
    expect(clean?.properties).toHaveProperty('$web_vitals_CLS_value', 0.07);
    for (const field of [
      '$web_vitals_INP_value',
      '$web_vitals_LCP_event',
      'entries',
      'attribution',
    ])
      expect(clean?.properties).not.toHaveProperty(field);
    for (const value of [-1, Number.POSITIVE_INFINITY, '10', 900001])
      expect(
        sanitizeEvent({ event: '$web_vitals', properties: { $web_vitals_INP_value: value } }),
      ).toBeNull();
  });

  it('enables anonymous persistence with usage consent and disables it immediately on opt-out', async () => {
    const sdk = makeSdk();
    const analytics = createAnalytics(async () => sdk);
    await analytics.setEnabled(true);
    expect(sdk.set_config).toHaveBeenCalledWith({
      persistence: 'localStorage',
      disable_persistence: false,
    });
    expect(sdk.capture).toHaveBeenCalledWith('$pageview', expect.any(Object));
    await analytics.setEnabled(false);
    expect(sdk.opt_out_capturing).toHaveBeenCalledOnce();
    expect(sdk.set_config).toHaveBeenLastCalledWith({ disable_persistence: true });
    analytics.captureWebVital({ name: 'LCP', value: 2000 });
    expect(sdk.capture).toHaveBeenCalledTimes(2);
  });

  it('rechecks consent before sends and discards vitals measured before SDK readiness', async () => {
    let allowed = true;
    const sdk = makeSdk();
    const analytics = createAnalytics(
      async () => sdk,
      () => allowed,
    );
    analytics.captureWebVital({ name: 'LCP', value: 1000 });
    await analytics.setEnabled(true);
    expect(sdk.capture).toHaveBeenCalledTimes(2);
    analytics.captureWebVital({ name: 'INP', value: 120 });
    expect(sdk.capture).toHaveBeenCalledTimes(3);
    allowed = false;
    analytics.captureWebVital({ name: 'CLS', value: 0.1 });
    const config = sdk.init.mock.calls[0][1];
    expect(config.before_send({ event: '$pageleave', properties: {} })).toBeNull();
    expect(sdk.capture).toHaveBeenCalledTimes(3);
  });
});
