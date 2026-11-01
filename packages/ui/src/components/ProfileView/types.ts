import type { useProfileView } from '@/components/ProfileView/hooks/useProfileView.ts';
import type { useProfileNotes } from './hooks/useProfileNotes.ts';
import type { useProfileWorkspace } from './hooks/useProfileWorkspace.ts';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { ProfileFile, Snapshot } from '@pitchcrew/core';

export interface ProfileViewProps {
  data: Snapshot;
  action: Action;
  working: boolean;
}
export type ProfileViewModel = NonNullable<ReturnType<typeof useProfileView>>;
export type ProfileTreeModel = ReturnType<typeof useProfileNotes>;
export type ProfileWorkspaceModel = ReturnType<typeof useProfileWorkspace>;

/** Shared props for the page sections composed by ProfileView. */
export interface ProfileSectionProps {
  controller: ProfileViewModel;
  tree: ProfileTreeModel;
  workspace: ProfileWorkspaceModel;
}

export interface ProfileDocument {
  id: string;
  name: string;
  content: string;
  saved: { name: string; content: string };
  error: string;
}

export interface ProfileDocumentsState {
  documents: ProfileDocument[];
  activeId: string | null;
}

export interface ProfileTreeNode {
  key: string;
  label: string;
  path: string;
  folder: boolean;
  note?: ProfileFile;
  children: ProfileTreeNode[];
}
export type ProfileFolderOperation =
  | { kind: 'create'; parent: string }
  | { kind: 'move'; name: string; current: string }
  | { kind: 'rename'; note: { name: string; content: string } };
export type ProfileFolderChange = Exclude<ProfileFolderOperation, { kind: 'rename' }>;
