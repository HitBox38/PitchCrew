import type { ProfileFile, Snapshot } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { useProfileSources } from './hooks/useProfileSources.ts';

export interface ProfileSourcesProps {
  data: Snapshot;
  action: Action;
  working: boolean;
  requestImport: (action: () => void) => void;
  openImported: (file: ProfileFile) => void;
}
export type ProfileSourcesModel = ReturnType<typeof useProfileSources>;
