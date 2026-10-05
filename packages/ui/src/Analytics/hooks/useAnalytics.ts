import { useEffect, useRef } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { analyticsKey, useDevicePreferences } from '../../lib/device-preferences.ts';
import { loadAnalyticsConfig, useAnalyticsConfig } from '../api.ts';
import { analytics } from '../client.ts';
import { analyticsPage } from '../helpers.ts';

export function useAnalytics() {
  const enabled = useDevicePreferences((state) => state.analytics);
  const config = useAnalyticsConfig((state) => state.config);
  const page = useRouterState({ select: (state) => analyticsPage(state.location.pathname) });
  const latestPage = useRef(page);
  useEffect(() => {
    latestPage.current = page;
    analytics.capture('$pageview', { page });
  }, [page]);
  useEffect(() => {
    void loadAnalyticsConfig();
    const synchronize = (event: StorageEvent) => {
      if (event.key !== analyticsKey && event.key !== null) return;
      const next = event.key === null || event.newValue !== 'false';
      const preferences = useDevicePreferences.getState();
      if (preferences.analytics !== next) preferences.setAnalytics(next);
    };
    window.addEventListener('storage', synchronize);
    return () => window.removeEventListener('storage', synchronize);
  }, []);
  useEffect(() => {
    let active = true;
    void analytics.setEnabled(enabled, config).then((ready) => {
      if (active && ready) analytics.capture('$pageview', { page: latestPage.current });
    });
    return () => {
      active = false;
      void analytics.setEnabled(false, config);
    };
  }, [enabled, config]);
}
