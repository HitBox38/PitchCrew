import { useDevicePreferences } from '../../lib/device-preferences.ts';
import { useAnalyticsConfig } from '../api.ts';
import { analyticsContext } from '../context.ts';
import { createOperationalLogTransport } from './transport.ts';

/** Mounted shell installs once; central observation relay routes native records to capture. */
export const installOperationalLogs = (options: { getDistinctId: () => string | undefined }) => {
  const consent = () => {
    const preferences = useDevicePreferences.getState();
    return preferences.analytics && preferences.diagnostics;
  };
  const transport = createOperationalLogTransport({
    consent,
    getDistinctId: options.getDistinctId,
    context: () => {
      const context = analyticsContext();
      return { ...context, renderer: context.renderer === 'electron' ? 'electron' : 'browser' };
    },
  });
  const configure = () => transport.setEnabled(consent(), useAnalyticsConfig.getState().config);
  const unsubscribePreferences = useDevicePreferences.subscribe((next, previous) => {
    if (next.analytics !== previous.analytics || next.diagnostics !== previous.diagnostics)
      configure();
  });
  const unsubscribeConfig = useAnalyticsConfig.subscribe((next, previous) => {
    if (next.config !== previous.config) configure();
  });
  configure();
  return {
    capture: transport.capture,
    dispose: () => {
      unsubscribePreferences();
      unsubscribeConfig();
      transport.dispose();
    },
  };
};
