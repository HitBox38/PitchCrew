import { useWorkspaceStore } from '../../WorkspaceStore/index.ts';
import { useDevicePreferences } from '../../lib/device-preferences.ts';
import type { AnalyticsConfig } from '../types.ts';
import { createRunMetrics } from './runs.ts';
import {
  applicationMetricsAllowed,
  configureApplicationMetrics,
  invalidateApplicationMetrics,
  metricSink,
} from './runtime.ts';

/** Called once the production-configured analytics SDK is ready. */
export const installApplicationMetrics = (
  config: AnalyticsConfig,
  runLeadership: () => boolean = () => true,
) => {
  configureApplicationMetrics(config);
  const runs = createRunMetrics(metricSink, () => applicationMetricsAllowed() && runLeadership());
  runs.observe(useWorkspaceStore.getState().data?.runs ?? []);
  const stopWorkspace = useWorkspaceStore.subscribe((state, previous) => {
    if (state.data?.runs !== previous.data?.runs) runs.observe(state.data?.runs ?? []);
  });
  const stopPreferences = useDevicePreferences.subscribe((state, previous) => {
    if (state.analytics === previous.analytics && state.diagnostics === previous.diagnostics)
      return;
    invalidateApplicationMetrics();
    runs.reset();
    configureApplicationMetrics(state.analytics && state.diagnostics ? config : null);
  });
  return () => {
    stopWorkspace();
    stopPreferences();
    runs.reset();
    configureApplicationMetrics(null);
  };
};
