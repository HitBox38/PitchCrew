import type { JobProvider } from '@pitchcrew/core';
import type { useJobSources } from './hooks/useJobSources.ts';

export interface SourceDraft {
  provider: JobProvider;
  slug: string;
  name: string;
  enabled: boolean;
  titleInclude: string;
  titleExclude: string;
  locationInclude: string;
  remoteOnly: boolean;
}
export type JobSourcesModel = ReturnType<typeof useJobSources>;
