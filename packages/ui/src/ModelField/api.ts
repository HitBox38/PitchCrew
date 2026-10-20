import { api } from '@/api.ts';
import type { RuntimeId, RuntimeModelCatalog } from '@pitchcrew/core';

export const loadModelCatalog = (runtime: RuntimeId, refresh: boolean, signal: AbortSignal) => {
  return api<RuntimeModelCatalog>(`/runtimes/${runtime}/models`, 'POST', { refresh }, signal);
};
