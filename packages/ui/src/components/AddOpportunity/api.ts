import { api } from '@/api.ts';
import type { JobLookupResult } from '@pitchcrew/core';

/** Read one posting through fixed provider APIs or the bounded public-page reader. */
export function lookupJob(url: string, signal?: AbortSignal) {
  return api<JobLookupResult>('/jobs/lookup', 'POST', { url }, signal);
}
