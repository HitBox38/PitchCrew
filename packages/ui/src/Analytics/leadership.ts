import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { useEffect } from 'react';
import { useDevicePreferences } from '../lib/device-preferences.ts';
import { useAnalyticsConfig } from './api.ts';

const leadership = createStore(() => ({ active: false }));
export const isDiagnosticLeader = () => leadership.getState().active;
export const useDiagnosticLeader = () => useStore(leadership, (state) => state.active);

/** One renderer per origin observes shared runs/tools; user-action metrics stay per renderer. */
export function useDiagnosticLeadership() {
  const enabled = useDevicePreferences((state) => state.analytics && state.diagnostics);
  const configured = useAnalyticsConfig((state) => !!state.config);
  useEffect(() => {
    if (!enabled || !configured) return;
    let active = true;
    const controller = new AbortController();
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    if (!locks) leadership.setState({ active: true });
    else
      void locks
        .request('pitchcrew-diagnostic-observer', { signal: controller.signal }, async () => {
          if (!active) return;
          leadership.setState({ active: true });
          try {
            await released;
          } finally {
            leadership.setState({ active: false });
          }
        })
        .catch(() => {
          /* Aborted while waiting for another tab; no workspace error. */
        });
    return () => {
      active = false;
      leadership.setState({ active: false });
      release();
      controller.abort();
    };
  }, [enabled, configured]);
}
