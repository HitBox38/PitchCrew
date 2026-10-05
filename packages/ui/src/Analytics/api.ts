import { api } from '../api.ts';
import type { AnalyticsConfig } from './types.ts';
import { create } from 'zustand';

export const useAnalyticsConfig = create<{ config: AnalyticsConfig | null; loaded: boolean }>(
  () => ({ config: null, loaded: false }),
);
let loading: Promise<void> | undefined;

export function loadAnalyticsConfig() {
  loading ??= api<AnalyticsConfig | null>('/analytics/config')
    .then((config) => {
      useAnalyticsConfig.setState({ config, loaded: true });
    })
    .catch(() => {
      useAnalyticsConfig.setState({ config: null, loaded: true });
    });
  return loading;
}
