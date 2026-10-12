import type { PostHog, PostHogConfig } from 'posthog-js';
import type { Installer } from '../Downloads/types';
import { analyticsConfig, analyticsConfigured } from './config';
import { analyticsAllowed, sanitizeEvent } from './helpers';
import { analyticsContext } from './context';
import { heatmapConfig } from './heatmaps';

type Sdk = Pick<
  PostHog,
  'init' | 'capture' | 'set_config' | 'opt_in_capturing' | 'opt_out_capturing'
> & { heatmaps?: Pick<NonNullable<PostHog['heatmaps']>, 'getAndClearBuffer'> };
export const sdkConfig: Partial<PostHogConfig> = {
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: true,
  save_referrer: false,
  save_campaign_params: false,
  respect_dnt: true,
  debug: false,
  disable_persistence: false,
  capture_dead_clicks: false,
  rageclick: heatmapConfig.rageclick,
  mask_all_text: true,
  mask_all_element_attributes: true,
  capture_heatmaps: false,
  disable_session_recording: true,
  disable_surveys: true,
  capture_exceptions: false,
  capture_performance: false,
  advanced_disable_flags: true,
  disable_external_dependency_loading: true,
  person_profiles: 'never',
  ip: false,
  persistence: 'localStorage',
  opt_out_persistence_by_default: true,
  request_batching: false,
};

export function createAnalytics(load: () => Promise<Sdk>, allowed = () => true) {
  let sdk: Sdk | undefined;
  let loading: Promise<Sdk> | undefined;
  let initialized = false;
  let enabled = false;
  let generation = 0;
  let pageCaptured = false;
  let nativePageCaptured = false;
  return {
    async setEnabled(next: boolean) {
      const current = ++generation;
      enabled = false;
      if (!next || !allowed()) {
        nativePageCaptured = false;
        try {
          sdk?.opt_out_capturing();
          sdk?.set_config({ disable_persistence: true, capture_heatmaps: false, rageclick: false });
          sdk?.heatmaps?.getAndClearBuffer();
        } catch {
          /* Best effort. */
        }
        return;
      }
      try {
        loading ??= load();
        const loaded = await loading;
        if (current !== generation || !allowed()) return;
        sdk = loaded;
        if (!initialized) {
          sdk.init(analyticsConfig.token, {
            ...sdkConfig,
            api_host: analyticsConfig.host,
            before_send: (event) => (enabled && allowed() ? sanitizeEvent(event) : null),
          });
          initialized = true;
        }
        sdk.set_config({
          persistence: 'localStorage',
          disable_persistence: false,
        });
        sdk.opt_in_capturing({ captureEventName: false });
        enabled = true;
        sdk.set_config(heatmapConfig);
        if (!nativePageCaptured) {
          sdk.capture('$pageview', analyticsContext);
          nativePageCaptured = true;
        }
        if (!pageCaptured) {
          sdk.capture('landing_page_viewed', analyticsContext);
          pageCaptured = true;
        }
      } catch {
        loading = undefined;
      }
    },
    capturePageview() {
      if (!enabled || !sdk || !allowed()) return;
      try {
        sdk.capture('$pageview', analyticsContext);
      } catch {
        /* BFCache restoration never depends on analytics. */
      }
    },
    captureWebVital(metric: { name: string; value: number }) {
      if (!enabled || !sdk || !allowed()) return;
      const event = sanitizeEvent({
        event: '$web_vitals',
        properties: { [`$web_vitals_${metric.name}_value`]: metric.value },
      });
      if (!event) return;
      try {
        sdk.capture(event.event, event.properties);
      } catch {
        /* Performance reporting never affects the page. */
      }
    },
    capture(installer: Installer) {
      if (!enabled || !sdk || !allowed()) return;
      try {
        sdk.capture('landing_download_clicked', {
          installer: installer.id,
          destination: installer.filename ? 'installer' : 'releases',
          ...analyticsContext,
        });
      } catch {
        /* A download never depends on analytics. */
      }
    },
  };
}

export const analytics = createAnalytics(
  async () => {
    const [{ PostHog }] = await Promise.all([
      import('posthog-js/no-external'),
      // Locally bundled detector; no recording and no remotely loaded scripts.
      import('posthog-js/dist/dead-clicks-autocapture'),
    ]);
    return new PostHog();
  },
  () => {
    try {
      return (
        analyticsConfigured() &&
        window.location.pathname === '/' &&
        analyticsAllowed(window.localStorage, navigator.doNotTrack)
      );
    } catch {
      return false;
    }
  },
);
export function captureDownload(installer: Installer) {
  analytics.capture(installer);
}
