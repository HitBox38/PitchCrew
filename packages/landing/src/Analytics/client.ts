import type { PostHog, PostHogConfig } from 'posthog-js';
import type { Installer } from '../Downloads/types';
import { analyticsConfig } from './config';
import { sanitizeEvent } from './helpers';

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
  persistence: 'memory',
  opt_out_persistence_by_default: true,
  request_batching: false,
};

export function createAnalytics(load: () => Promise<Sdk>) {
  let sdk: Sdk | undefined;
  let loading: Promise<Sdk> | undefined;
  let initialized = false;
  let enabled = false;
  let generation = 0;
  let pageCaptured = false;
  return {
    async setEnabled(next: boolean) {
      const current = ++generation;
      enabled = false;
      if (!next) {
        try {
          sdk?.opt_out_capturing();
        } catch {
          /* Best effort. */
        }
        return;
      }
      try {
        loading ??= load();
        const loaded = await loading;
        if (current !== generation) return;
        sdk = loaded;
        if (!initialized) {
          sdk.init(analyticsConfig.token, {
            ...sdkConfig,
            api_host: analyticsConfig.host,
            before_send: (event) => (enabled ? sanitizeEvent(event) : null),
          });
          initialized = true;
        }
        sdk.opt_in_capturing({ captureEventName: false });
        enabled = true;
        if (!pageCaptured) {
          sdk.capture('landing_page_viewed');
          pageCaptured = true;
        }
      } catch {
        loading = undefined;
      }
    },
    capture(installer: Installer) {
      if (!enabled || !sdk) return;
      try {
        sdk.capture('landing_download_clicked', {
          installer: installer.id,
          destination: installer.filename ? 'installer' : 'releases',
        });
      } catch {
        /* A download never depends on analytics. */
      }
    },
  };
}

export const analytics = createAnalytics(async () => {
  const { PostHog } = await import('posthog-js/no-external');
  return new PostHog();
});
export function captureDownload(installer: Installer) {
  analytics.capture(installer);
}
