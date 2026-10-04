import type { View } from '@/navigation.ts';
import type { Card, Role, RoleId } from '@pitchcrew/core';

export interface StageLink {
  id: string;
  label: string;
  color: string;
  count: number;
}

export interface AppSidebarProps {
  view: View | undefined;
  stages: StageLink[];
  onStage: (id: string) => void;
  counts: Partial<Record<View, number>>;
  roles: Role[];
  roleStatus: (role: Role) => string;
  runningRoles: RoleId[];
  onConfigureRole: (id: RoleId) => void;
  onChatRole: (id: RoleId) => void;
  onToggleRole: (role: Role) => void;
  recent: Card[];
  onOpenCard: (id: string) => void;
  onSearch: () => void;
  onAddJob: () => void;
  working: boolean;
}
export type AppSidebarModel = AppSidebarProps;

export type CrewLinksProps = Pick<
  AppSidebarModel,
  | 'roles'
  | 'runningRoles'
  | 'roleStatus'
  | 'onChatRole'
  | 'onConfigureRole'
  | 'working'
  | 'onToggleRole'
>;

export type RecentJobsProps = Pick<AppSidebarModel, 'recent' | 'onOpenCard'>;

export type SidebarHeadingProps = Pick<AppSidebarModel, 'onSearch' | 'onAddJob'>;

export type WorkspaceLinksProps = Pick<AppSidebarModel, 'view' | 'stages' | 'onStage' | 'counts'>;
