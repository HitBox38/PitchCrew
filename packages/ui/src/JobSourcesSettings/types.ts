import type { JobProvider } from '@pitchcrew/core';
import type { useJobSources } from './hooks/useJobSources.ts';

export interface SourceDraft {
  provider: JobProvider;
  /** Board, account or company UID; the Comeet company UID for Comeet. */
  slug: string;
  /** Comeet careers token. Kept in the draft when switching providers, sent only for Comeet. */
  token: string;
  name: string;
  enabled: boolean;
  titleInclude: string;
  titleExclude: string;
  locationInclude: string;
  remoteOnly: boolean;
}
export type JobSourcesModel = ReturnType<typeof useJobSources>;
/** What a pasted board name or link reveals about a source. */
export type BoardLink = Partial<Pick<SourceDraft, 'provider' | 'slug' | 'token'>>;
