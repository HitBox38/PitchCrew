import type { DesktopStartupBridge } from '../../../../core/src/desktop-startup.ts';
import { useDevicePreferences } from '../../lib/device-preferences.ts';
import { analytics } from '../client.ts';
import { createStartupTracker } from './tracker.ts';

declare global {
  interface Window {
    pitchcrewStartup?: DesktopStartupBridge;
  }
}

export const startupTracker = createStartupTracker({
  read: async () => window.pitchcrewStartup?.getTiming() ?? null,
  allowed: () => {
    const state = useDevicePreferences.getState();
    return state.analytics && state.diagnostics;
  },
  enabled: () => analytics.diagnosticsEnabled(),
  capture: (event, properties) => analytics.captureDiagnostic(event, properties),
});

useDevicePreferences.subscribe((state) => {
  if (!state.analytics || !state.diagnostics) startupTracker.discard();
});
