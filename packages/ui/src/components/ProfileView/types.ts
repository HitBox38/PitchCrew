import type { useProfileView } from '@/components/ProfileView/hooks/useProfileView.ts';
import type { useProfileCitations } from './hooks/useProfileCitations.ts';
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
export type ProfileCitationsModel = ReturnType<typeof useProfileCitations>;

/** Shared props for the page sections composed by ProfileView. */
export interface ProfileSectionProps {
  controller: ProfileViewModel;
  tree: ProfileTreeModel;
  workspace: ProfileWorkspaceModel;
  citations: ProfileCitationsModel;
}

export interface ProfileDocument {
  id: string;
  /** Bumped when a disk copy replaces the text; the editor then starts a fresh undo history. */
  revision: number;
  name: string;
  content: string;
  /** The copy last read from or written to disk. */
  saved: { name: string; content: string };
  /** False for a note that has never been saved, or whose file was removed outside the editor. */
  persisted: boolean;
  error: string;
  /** The disk copy changed (or disappeared, `null`) underneath an unsaved draft. */
  conflict: { current: string | null } | null;
  /** Content of the save in flight, so its own echo is never mistaken for an outside change. */
  saving: string | null;
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
  /** A folder the user made (renamable); imported-source folders follow their source paths. */
  explicit?: boolean;
  note?: ProfileFile;
  children: ProfileTreeNode[];
}
export type ProfileFolderOperation =
  | { kind: 'create'; parent: string }
  | { kind: 'move'; name: string; current: string }
  | { kind: 'rename-folder'; path: string };
export type ProfileFolderChange = Exclude<ProfileFolderOperation, { kind: 'rename-folder' }>;
