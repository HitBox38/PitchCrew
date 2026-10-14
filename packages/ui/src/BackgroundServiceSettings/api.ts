import { api } from '@/api.ts';
import type { BackgroundServiceInfo } from '@pitchcrew/core';

export function loadBackgroundService(signal: AbortSignal) {
  return api<BackgroundServiceInfo>('/background-service', 'GET', undefined, signal);
}

export function installBackgroundService() {
  return api<BackgroundServiceInfo>('/background-service/install', 'POST');
}
