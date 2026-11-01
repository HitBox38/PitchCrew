import type { useRoleSettings } from '@/components/RoleSettings/hooks/useRoleSettings.ts';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { Role, Snapshot } from '@pitchcrew/core';
import type { ReactNode } from 'react';

export interface RoleSettingsProps {
  reviewInstructions?: boolean;
  docked?: boolean;
  registerLeaveGuard?: (guard: ((action: () => void) => void) | null) => void;
  role: Role;
  creating?: boolean;
  data: Snapshot;
  action: Action;
  working: boolean;
  onClose: () => void;
  onManageSkills: () => void;
}
export type RoleSettingsModel = NonNullable<ReturnType<typeof useRoleSettings>>;

export type RoleSkillsProps = Pick<RoleSettingsModel, 'role' | 'data' | 'onManageSkills'>;

export type RuntimeSettingsProps = Pick<
  RoleSettingsModel,
  | 'role'
  | 'runtime'
  | 'setRuntime'
  | 'setModel'
  | 'reasoning'
  | 'setReasoning'
  | 'runtimeItems'
  | 'runtimeAvailable'
  | 'runtimeCatalog'
  | 'model'
  | 'enabled'
  | 'setEnabled'
> & {
  children?: ReactNode;
  stacked?: boolean;
  bare?: boolean;
  /** The agent panel's header owns enable/pause for existing roles. */
  hideEnabled?: boolean;
};
