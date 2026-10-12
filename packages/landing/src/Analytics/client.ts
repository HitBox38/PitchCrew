import { createReplay, loadLocalRecorder } from '../../../ui/src/Analytics/replay/recorder';
import { sanitizeReplayProperties } from '../../../ui/src/Analytics/replay/privacy';
import type { PostHog, PostHogConfig } from 'posthog-js';
import type { Installer } from '../Downloads/types';
import { analyticsConfig, analyticsConfigured } from './config';
import { analyticsAllowed, replayAllowed, sanitizeEvent } from './helpers';
import { analyticsContext } from './context';
import { heatmapConfig } from './heatmaps';

type Sdk = Pick<
  PostHog,
  'init' | 'capture' | 'set_config' | 'opt_in_capturing' | 'opt_out_capturing'
> &
  Partial<Pick<PostHog, 'sessionManager'>> &
  { heatmaps?: Pick<NonNullable<PostHog['heatmaps']>, 'getAndClearBuffer'> };
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

export function createAnalytics(
  load: () => Promise<Sdk>,
  allowed = () => true,
  replayConsent = () => false,
  loadRecorder = loadLocalRecorder,
) {
  let sdk: Sdk | undefined;
  let loading: Promise<Sdk> | undefined;
  let initialized = false;
  let enabled = false;
  let generation = 0;
  let pageCaptured = false;
  let nativePageCaptured = false;
  let replaySession: string | undefined;
  const replay = createReplay(
    loadRecorder,
    () => enabled && allowed() && replayConsent(),
    (events) => {
      const ids = sdk?.sessionManager?.checkAndGetSessionAndWindowId(true);
      if (!sdk || !ids) return;
      if (replaySession && replaySession !== ids.sessionId) {
        // A new native session needs its own meta/full snapshot, not old-session mutations.
        replaySession = ids.sessionId;
        replay.stop();
        void replay.setEnabled(replayConsent());
        return;
      }
      replaySession = ids.sessionId;
      const properties = sanitizeReplayProperties({
        $snapshot_data: events,
        $session_id: ids.sessionId,
        $window_id: ids.windowId,
      });
      if (properties)
        sdk.capture(
          '$snapshot',
          { ...properties, ...analyticsContext },
          { _url: `${analyticsConfig.host}/s/`, _noTruncate: true },
        );
    },
  );
  return {
    setReplayEnabled(next: boolean) {
      return replay.setEnabled(next && enabled);
    },
    async setEnabled(next: boolean) {
      const current = ++generation;
      enabled = false;
      replay.stop();
      replaySession = undefined;
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
            before_send: (event) => {
              if (!enabled || !allowed()) return null;
              if (event?.event === '$snapshot') {
                const properties = replayConsent()
                  ? sanitizeReplayProperties(event.properties)
                  : null;
                return properties
                  ? { ...event, properties: { ...properties, ...analyticsContext } }
                  : null;
              }
              return sanitizeEvent(event);
            },
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
        void replay.setEnabled(replayConsent());
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
  () => {
    try {
      return replayAllowed(window.localStorage, navigator.doNotTrack);
    } catch {
      return false;
    }
  },
);
export function captureDownload(installer: Installer) {
  analytics.capture(installer);
}
