import { normalizeApplicationText, type JobPosting, type JobSourceFilters } from '@pitchcrew/core';

/**
 * Case-insensitive keyword matching. Empty include lists match everything; any exclude keyword
 * rejects the title. A remote-only source keeps postings the provider or location marks remote.
 */
export const matchesFilters = (posting: JobPosting, filters: JobSourceFilters): boolean => {
  if (filters.titleInclude.length && !matchesAny(posting.title, filters.titleInclude)) return false;
  if (filters.titleExclude.length && matchesAny(posting.title, filters.titleExclude)) return false;
  if (filters.locationInclude.length && !matchesAny(posting.location, filters.locationInclude))
    return false;
  if (filters.remoteOnly && !posting.remote) return false;
  return true;
};

const matchesAny = (value: string, keywords: string[]) => {
  const text = normalizeApplicationText(value);
  return keywords.some((keyword) => text.includes(normalizeApplicationText(keyword)));
};
