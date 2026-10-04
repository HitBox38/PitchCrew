import { api } from '@/api.ts';
import type { StaleSubmission } from '@pitchcrew/core';

export function previewStaleSubmissions(days: number, signal?: AbortSignal) {
  return api<{ days: number; checkedAt: string; cards: StaleSubmission[] }>(
    `/insights/stale?days=${days}`,
    'GET',
    undefined,
    signal,
  );
}
