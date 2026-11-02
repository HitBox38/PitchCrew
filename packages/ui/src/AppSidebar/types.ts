import type { View } from '@/navigation.ts';
import type { Card, Role, RoleId, Snapshot } from '@pitchcrew/core';

export type SidebarCounts = Partial<Record<View, number>>;

export interface AppSidebarProps {
  data: Snapshot;
  view: View | undefined;
  counts: SidebarCounts;
  /** Recently opened jobs, newest first (at most five). */
  recent: Card[];
  working: boolean;
  onOpenCard: (id: string) => void;
  onConfigureRole: (id: RoleId) => void;
  onToggleRole: (role: Role) => Promise<unknown> | void;
}

export type WorkspaceLinksProps = Pick<AppSidebarProps, 'view' | 'counts'>;

export type CrewRolesProps = Pick<
  AppSidebarProps,
  'data' | 'working' | 'onConfigureRole' | 'onToggleRole'
>;
