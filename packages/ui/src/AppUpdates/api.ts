import { api } from '../api.ts';
import type { AppUpdateInfo } from '@pitchcrew/core';

export const loadAppUpdate = () => api<AppUpdateInfo>('/app-updates');
export const checkAppUpdate = (manual: boolean) =>
  api<AppUpdateInfo>(`/app-updates/check${manual ? '?manual=true' : ''}`, 'POST');
