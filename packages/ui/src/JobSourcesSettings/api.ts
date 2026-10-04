import { api } from '@/api.ts';
import type { JobSource, JobSourceInput, JobSourcePreview } from '@pitchcrew/core';

export function loadJobSources(signal?: AbortSignal) {
  return api<JobSource[]>('/job-sources', 'GET', undefined, signal);
}
export function previewJobSource(input: JobSourceInput, signal?: AbortSignal) {
  return api<JobSourcePreview>('/job-sources/preview', 'POST', input, signal);
}
