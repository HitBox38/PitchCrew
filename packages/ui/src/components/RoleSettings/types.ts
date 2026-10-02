import type { useRoleSettings } from '@/components/RoleSettings/hooks/useRoleSettings.ts';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { Role, Snapshot } from '@pitchcrew/core';

export interface RoleSettingsProps {
  role: Role;
  data: Snapshot;
  action: Action;
  working: boolean;
  onClose: () => void;
  onManageSkills: () => void;
}
export type RoleSettingsModel = NonNullable<ReturnType<typeof useRoleSettings>>;

export type CapabilitySettingsProps = Pick<
  RoleSettingsModel,
  'role' | 'capabilities' | 'setCapabilities'
>;

export type InstructionSettingsProps = Pick<
  RoleSettingsModel,
  'role' | 'instructions' | 'setInstructions'
>;

export type RoleSettingsFooterProps = Pick<
  RoleSettingsModel,
  'error' | 'onClose' | 'working' | 'runtimeAvailable'
>;

export type RoleSettingsHeadingProps = Pick<RoleSettingsModel, 'role' | 'onClose'>;

export type RoleSkillsProps = Pick<RoleSettingsModel, 'role' | 'data' | 'onManageSkills'>;

export type RuntimeSettingsProps = Pick<
  RoleSettingsModel,
  | 'role'
  | 'runtime'
  | 'setRuntime'
  | 'setModel'
  | 'runtimeItems'
  | 'runtimeAvailable'
  | 'runtimeCatalog'
  | 'model'
  | 'enabled'
  | 'setEnabled'
>;
