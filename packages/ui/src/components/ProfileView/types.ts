import type { useProfileView } from '@/components/ProfileView/hooks/useProfileView.ts';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { Snapshot } from '@pitchcrew/core';

export interface ProfileViewProps {
  data: Snapshot;
  action: Action;
  working: boolean;
}
export type ProfileViewModel = NonNullable<ReturnType<typeof useProfileView>>;

export type ProfileLocationProps = Pick<ProfileViewModel, 'data'>;

export type ProfileNotesProps = Pick<ProfileViewModel, 'data' | 'name' | 'openNote' | 'createNote'>;
