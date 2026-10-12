import { useWorkspaceStore } from '../../WorkspaceStore/index.ts';
import { productSetupProperties } from '../product.ts';
import { useEffect, useRef, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import {
  synchronizeTelemetryPreferences,
  useDevicePreferences,
} from '../../lib/device-preferences.ts';
import { loadAnalyticsConfig, useAnalyticsConfig } from '../api.ts';
import { analytics } from '../client.ts';
import { analyticsPage } from '../helpers.ts';
import { installApplicationMetrics } from '../metrics/install.ts';
import { isDiagnosticLeader, useDiagnosticLeader } from '../leadership.ts';

export function useAnalytics() {
  const leader = useDiagnosticLeader();
  const enabled = useDevicePreferences((state) => state.analytics);
  const config = useAnalyticsConfig((state) => state.config);
  const [ready, setReady] = useState<{ config: typeof config } | null>(null);
  const page = useRouterState({ select: (state) => analyticsPage(state.location.pathname) });
  const data = useWorkspaceStore((state) => state.data);
  const latestSetup = useRef(productSetupProperties(data));
  const latestPage = useRef(page);
  useEffect(() => {
    latestSetup.current = productSetupProperties(data);
    if (latestSetup.current) analytics.capture('workspace_setup_observed', latestSetup.current);
  }, [data]);
  useEffect(() => {
    latestPage.current = page;
    analytics.capture('$pageview', { page });
  }, [page]);
  useEffect(() => {
    void loadAnalyticsConfig();
    const synchronize = synchronizeTelemetryPreferences;
    window.addEventListener('storage', synchronize);
    return () => window.removeEventListener('storage', synchronize);
  }, []);
  useEffect(() => {
    let active = true;
    void analytics.setEnabled(enabled, config).then((ready) => {
      if (!active) return;
      setReady(ready && config ? { config } : null);
      if (ready) {
        analytics.capture('$pageview', { page: latestPage.current });
        if (latestSetup.current) analytics.capture('workspace_setup_observed', latestSetup.current);
      }
    });
    return () => {
      active = false;
      void analytics.setEnabled(false, config);
    };
  }, [enabled, config]);
  useEffect(() => {
    if (ready?.config === config && enabled && config)
      return installApplicationMetrics(config, isDiagnosticLeader);
  }, [ready, enabled, config, leader]);
}
