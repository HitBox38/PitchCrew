import { api } from '@/api.ts';
import type { BackgroundServiceInfo } from '@pitchcrew/core';

export const loadBackgroundService = (signal: AbortSignal) => {
  return api<BackgroundServiceInfo>('/background-service', 'GET', undefined, signal);
};

export const installBackgroundService = () => {
  return api<BackgroundServiceInfo>('/background-service/install', 'POST');
};
