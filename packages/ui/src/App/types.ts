import type { getWorkspaceModel } from '@/App/helpers.tsx';
import type { Snapshot } from '@pitchcrew/core';
import type { useApp } from './hooks/useApp.ts';

export type ReadyWorkspaceProps = Omit<ReturnType<typeof useApp>, 'data'> & { data: Snapshot };
export type WorkspaceModel = NonNullable<ReturnType<typeof getWorkspaceModel>>;

export type WorkspaceHeadingProps = Pick<WorkspaceModel, 'title' | 'fact'>;

export type WorkspaceNotificationProps = Pick<WorkspaceModel, 'toast' | 'toastType' | 'setToast'>;

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
  | 'pending'
  | 'data'
  | 'openCard'
  | 'setPaletteOpen'
  | 'setAdd'
  | 'recentCards'
  | 'toggleRole'
  | 'setRoleId'
  | 'working'
>;
