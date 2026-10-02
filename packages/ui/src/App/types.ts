import type { getWorkspaceModel } from '@/App/helpers.tsx';
import type { Snapshot } from '@pitchcrew/core';
import type { useApp } from './hooks/useApp.ts';

export type ReadyWorkspaceProps = Omit<ReturnType<typeof useApp>, 'data'> & { data: Snapshot };
export type WorkspaceModel = NonNullable<ReturnType<typeof getWorkspaceModel>>;

export type WorkspaceHeadingProps = Pick<
  WorkspaceModel,
  'view' | 'summary' | 'data' | 'setAdd' | 'working' | 'checkRuntimes'
>;

export type WorkspaceNotificationProps = Pick<
  WorkspaceModel,
  'toast' | 'reduced' | 'selectedRole' | 'setToast'
>;

export type WorkspacePaletteProps = Pick<
  WorkspaceModel,
  | 'paletteOpen'
  | 'setPaletteOpen'
  | 'data'
  | 'go'
  | 'openCard'
  | 'setRoleId'
  | 'openChat'
  | 'setAdd'
  | 'checkRuntimes'
  | 'setTheme'
  | 'copyDirectory'
>;

export type WorkspacePanelsProps = Pick<
  WorkspaceModel,
  | 'add'
  | 'action'
  | 'working'
  | 'setAdd'
  | 'selected'
  | 'data'
  | 'setSelectedId'
  | 'go'
  | 'selectedRole'
  | 'navigate'
  | 'setRoleId'
>;

export type WorkspaceSidebarProps = Pick<
  WorkspaceModel,
  | 'view'
  | 'stageLinks'
  | 'jumpToStage'
  | 'pending'
  | 'data'
  | 'roleStatus'
  | 'running'
  | 'setRoleId'
  | 'openChat'
  | 'toggleRole'
  | 'recentCards'
  | 'openCard'
  | 'setPaletteOpen'
  | 'setAdd'
  | 'theme'
  | 'setTheme'
  | 'copyDirectory'
  | 'working'
>;

export type WorkspaceToolbarProps = Pick<WorkspaceModel, 'running' | 'data'>;
