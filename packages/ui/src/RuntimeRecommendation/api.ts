import { api } from '@/api.ts';
import type { RuntimeRecommendation } from '@pitchcrew/core';

export function loadRuntimeRecommendation(roleId: string, signal: AbortSignal) {
  return api<RuntimeRecommendation>(`/roles/${roleId}/runtime-recommendation`, 'POST', {}, signal);
}
