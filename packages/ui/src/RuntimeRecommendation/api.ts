import { api } from '@/api.ts';
import type { RuntimeRecommendation } from '@pitchcrew/core';

export const loadRuntimeRecommendation = (roleId: string, signal: AbortSignal) => {
  return api<RuntimeRecommendation>(`/roles/${roleId}/runtime-recommendation`, 'POST', {}, signal);
};
