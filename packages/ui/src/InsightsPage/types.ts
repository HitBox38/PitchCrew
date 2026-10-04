import type { TagSort } from '@pitchcrew/core/insights';

/** URL-backed filters. Dates are local wall-clock values from the shared date picker. */
export interface InsightsSearch {
  tag?: string;
  from?: string;
  to?: string;
  sort?: TagSort;
}
export type ChangeSearch = (patch: Partial<InsightsSearch>) => void;
