import type { PostHog, PostHogConfig } from 'posthog-js';
import { useDevicePreferences } from '../lib/device-preferences.ts';
import { createReplay, loadLocalRecorder } from './replay/recorder.ts';
import { sanitizeReplayProperties } from './replay/privacy.ts';
import { sanitizeDiagnostic } from './diagnostics.ts';
import { sanitizeEvent } from './helpers.ts';
import { analyticsContext } from './context.ts';
import type { AnalyticsConfig, AnalyticsEvent, AnalyticsProperties } from './types.ts';

type Sdk = Pick<PostHog, 'init' | 'capture' | 'opt_in_capturing' | 'opt_out_capturing'> &
  Partial<Pick<PostHog, 'get_distinct_id' | 'sessionManager' | 'set_config'>>;

export const sdkConfig: Partial<PostHogConfig> = {
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  capture_dead_clicks: false,
  capture_heatmaps: false,
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
export function createAnalytics(
  loadSdk: () => Promise<Sdk>,
  consent: () => boolean = () => true,
  diagnosticsConsent: () => boolean = () => true,
  replayConsent: () => boolean = () => false,
  loadRecorder = loadLocalRecorder,
) {
  let sdk: Sdk | undefined;
  let loading: Promise<Sdk> | undefined;
  let initialized = false;
  let enabled = false;
  let generation = 0;
  let lastPage: AnalyticsProperties['page'];
  let lastSetup: string | undefined;
  let activeConfig: AnalyticsConfig | null = null;
  let initializedConfig: AnalyticsConfig | null = null;
  let replaySession: string | undefined;
  const replay = createReplay(
    loadRecorder,
    () => enabled && consent() && replayConsent(),
    (events) => {
      const ids = sdk?.sessionManager?.checkAndGetSessionAndWindowId(true);
      if (!sdk || !activeConfig || !ids) return;
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
          { ...properties, ...analyticsContext() },
          { _url: `${activeConfig.host}/s/`, _noTruncate: true },
        );
    },
  );
  return {
    setReplayEnabled(next: boolean) {
      return replay.setEnabled(next && enabled);
    },
    getDistinctId(): string | undefined {
      if (!enabled || !sdk || !consent() || !diagnosticsConsent()) return;
      try {
        const id = sdk.get_distinct_id?.();
        return typeof id === 'string' && id.length > 0 && id.length <= 200 ? id : undefined;
      } catch {
        return;
      }
    },
    async setEnabled(next: boolean, config: AnalyticsConfig | null): Promise<boolean> {
      const current = ++generation;
      enabled = false;
      activeConfig = config;
      replay.stop();
      replaySession = undefined;
      lastPage = undefined;
      lastSetup = undefined;
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
            before_send: (event) => {
              if (!enabled || !consent()) return null;
              if (event?.event === '$snapshot') {
                const properties = replayConsent()
                  ? sanitizeReplayProperties(event.properties)
                  : null;
                return properties
                  ? { ...event, properties: { ...properties, ...analyticsContext() } }
                  : null;
              }
              return sanitizeEvent(event, diagnosticsConsent());
            },
          });
          initialized = true;
          initializedConfig = config;
        } else if (
          initializedConfig?.token !== config.token ||
          initializedConfig.host !== config.host
        ) {
          if (!sdk.set_config) return false;
          sdk.set_config({ token: config.token, api_host: config.host });
          initializedConfig = config;
        }
        sdk.opt_in_capturing({ captureEventName: false });
        enabled = true;
        void replay.setEnabled(replayConsent());
        return true;
      } catch {
        loading = undefined;
        return false;
      }
    },
    diagnosticsEnabled() {
      return enabled && !!sdk && consent() && diagnosticsConsent();
    },
    captureDiagnostic(event: string, input: Record<string, unknown> = {}) {
      if (!enabled || !sdk || !consent() || !diagnosticsConsent()) return;
      const properties = sanitizeDiagnostic(event, input);
      if (!properties) return;
      try {
        const observedStart = properties.observed_start_ms;
        delete properties.observed_start_ms;
        const timestamp =
          (event === '$ai_trace' || event === '$ai_span') && typeof observedStart === 'number'
            ? new Date(observedStart)
            : undefined;
        if (timestamp) sdk.capture(event, { ...properties, ...analyticsContext() }, { timestamp });
        else sdk.capture(event, { ...properties, ...analyticsContext() });
      } catch {
        /* Diagnostics are best effort and never interrupt user actions. */
      }
    },
    capture(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
      if (!enabled || !sdk || !consent()) return;
      if (event === 'workspace_setup_observed') {
        const values = [properties.profile_ready, properties.crew_ready, properties.job_ready];
        if (values.some((value) => typeof value !== 'boolean')) return;
        const signature = JSON.stringify(values);
        if (signature === lastSetup) return;
        lastSetup = signature;
      }
      if (event === '$pageview') {
        if (!properties.page || lastPage === properties.page) return;
        lastPage = properties.page;
      }
      try {
        sdk.capture(event, { ...properties, ...analyticsContext() });
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
  () => useDevicePreferences.getState().diagnostics,
  () => useDevicePreferences.getState().replay,
);

// Consent changes stop the recorder synchronously, before React effects run.
useDevicePreferences.subscribe((state) => {
  void analytics.setReplayEnabled(state.analytics && state.replay);
});
