import { useEffect } from 'react';
import type { TelemetryBatch } from '@pitchcrew/core';
import { useDevicePreferences } from '../../lib/device-preferences.ts';
import { api } from '../../api.ts';
import { useAnalyticsConfig } from '../api.ts';
import { analytics } from '../client.ts';
import { createObservationRelay } from '../observations.ts';
import { useDiagnosticLeader } from '../leadership.ts';
import { installOperationalLogs } from '../logs/index.ts';

export const useBackendObservations = () => {
  const enabled = useDevicePreferences((state) => state.analytics && state.diagnostics);
  const configured = useAnalyticsConfig((state) => !!state.config);
  const leader = useDiagnosticLeader();
  // react-doctor-disable-next-line react-doctor/effect-needs-cleanup -- Cleanup clears the timer and prevents rescheduling after disposal.
  useEffect(() => {
    if (!enabled || !configured || !leader) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const logs = installOperationalLogs({ getDistinctId: analytics.getDistinctId });
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
      capture: (event, properties) => {
        if (event === 'operational_log') void logs.capture(event, properties);
        else analytics.captureDiagnostic(event, properties);
      },
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
      logs.dispose();
      clearTimeout(timer);
    };
  }, [enabled, configured, leader]);
};
