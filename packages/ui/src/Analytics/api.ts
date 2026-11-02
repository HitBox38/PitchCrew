import { api } from '../api.ts';
import type { AnalyticsConfig } from './types.ts';
import { create } from 'zustand';

export const loadAnalyticsConfig = () => {
  loading ??= api<AnalyticsConfig | null>(
    '/analytics/config',
    'GET',
    undefined,
    AbortSignal.timeout(5000),
  )
    .then((config) => {
      useAnalyticsConfig.setState({ config, loaded: true });
      return true;
    })
    .catch(() => {
      // A transport failure is not a configured installation opt-out.
      loading = undefined;
      useAnalyticsConfig.setState({ config: null, loaded: false });
      return false;
    });
  return loading;
};

/** Retry only local configuration discovery, never captured events or a disabled config. */
export const startAnalyticsConfigLoading = () => {
  let active = true;
  let delay = 1000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const load = async () => {
    const loaded = await loadAnalyticsConfig();
    if (!active || loaded) return;
    timer = setTimeout(load, delay);
    delay = Math.min(delay * 2, 30_000);
  };
  void load();
  return () => {
    active = false;
    clearTimeout(timer);
  };
};

export const useAnalyticsConfig = create<{ config: AnalyticsConfig | null; loaded: boolean }>(
  () => ({ config: null, loaded: false }),
);
let loading: Promise<boolean> | undefined;
