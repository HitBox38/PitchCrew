import type { PostHog, PostHogConfig } from 'posthog-js';
import { useDevicePreferences } from '../lib/device-preferences.ts';
import { sanitizeEvent } from './helpers.ts';
import type { AnalyticsConfig, AnalyticsEvent, AnalyticsProperties } from './types.ts';

type Sdk = Pick<PostHog, 'init' | 'capture' | 'opt_in_capturing' | 'opt_out_capturing'>;

export const sdkConfig: Partial<PostHogConfig> = {
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  capture_dead_clicks: false,
  rageclick: false,
  disable_session_recording: true,
  disable_surveys: true,
  capture_exceptions: false,
  capture_performance: false,
  advanced_disable_flags: true,
  disable_external_dependency_loading: true,
  person_profiles: 'never',
  ip: false,
  persistence: 'localStorage',
  opt_out_capturing_persistence_type: 'localStorage',
  opt_out_persistence_by_default: true,
  request_batching: false,
  before_send: sanitizeEvent,
};

/** No event queue: disabling consent drops all subsequent captures, including pending imports. */
export function createAnalytics(loadSdk: () => Promise<Sdk>, consent: () => boolean = () => true) {
  let sdk: Sdk | undefined;
  let loading: Promise<Sdk> | undefined;
  let initialized = false;
  let enabled = false;
  let generation = 0;
  let lastPage: AnalyticsProperties['page'];
  return {
    async setEnabled(next: boolean, config: AnalyticsConfig | null): Promise<boolean> {
      const current = ++generation;
      enabled = false;
      lastPage = undefined;
      if (!next || !config) {
        try {
          sdk?.opt_out_capturing();
        } catch {
          /* Analytics must never interrupt the app. */
        }
        return false;
      }
      try {
        loading ??= loadSdk();
        const loaded = await loading;
        if (current !== generation || !consent()) return false;
        sdk = loaded;
        if (!initialized) {
          sdk.init(config.token, {
            ...sdkConfig,
            api_host: config.host,
            before_send: (event) => (consent() ? sanitizeEvent(event) : null),
          });
          initialized = true;
        }
        sdk.opt_in_capturing({ captureEventName: false });
        enabled = true;
        return true;
      } catch {
        loading = undefined;
        return false;
      }
    },
    capture(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
      if (!enabled || !sdk || !consent()) return;
      if (event === '$pageview') {
        if (!properties.page || lastPage === properties.page) return;
        lastPage = properties.page;
      }
      try {
        sdk.capture(event, properties);
      } catch {
        /* Analytics is best effort. */
      }
    },
  };
}

export const analytics = createAnalytics(
  async () => {
    const { PostHog } = await import('posthog-js/no-external');
    return new PostHog();
  },
  () => useDevicePreferences.getState().analytics,
);
