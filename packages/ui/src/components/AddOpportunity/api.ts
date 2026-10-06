import { api } from '@/api.ts';
import type { JobLookupResult } from '@pitchcrew/core';

/** Ask the daemon to read one posting link. It fetches only fixed provider endpoints. */
export function lookupJob(url: string, signal?: AbortSignal) {
  return api<JobLookupResult>('/jobs/lookup', 'POST', { url }, signal);
}
