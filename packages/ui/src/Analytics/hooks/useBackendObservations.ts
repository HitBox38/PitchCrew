import { useEffect } from 'react';
import type { TelemetryBatch } from '@pitchcrew/core';
import { useDevicePreferences } from '../../lib/device-preferences.ts';
import { api } from '../../api.ts';
import { useAnalyticsConfig } from '../api.ts';
import { analytics } from '../client.ts';
import { createObservationRelay } from '../observations.ts';

export function useBackendObservations() {
  const enabled = useDevicePreferences((state) => state.analytics && state.diagnostics);
  const configured = useAnalyticsConfig((state) => !!state.config);
  useEffect(() => {
    if (!enabled || !configured) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const relay = createObservationRelay({
      allowed: () =>
        active &&
        useDevicePreferences.getState().analytics &&
        useDevicePreferences.getState().diagnostics,
      read: (after) =>
        api<TelemetryBatch>(
          `/telemetry/observations${after === undefined ? '' : `?after=${after}`}`,
          'GET',
          undefined,
          controller.signal,
        ),
      capture: (event, properties) => analytics.captureDiagnostic(event, properties),
    });
    const poll = async () => {
      await relay.poll();
      if (active) timer = setTimeout(poll, 2000);
    };
    void poll();
    return () => {
      active = false;
      relay.reset();
      controller.abort();
      clearTimeout(timer);
    };
  }, [enabled, configured]);
}
