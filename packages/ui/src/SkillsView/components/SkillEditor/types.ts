import type { useSkillEditor } from '@/SkillsView/components/SkillEditor/hooks/useSkillEditor.ts';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { Role, RoleId, Skill } from '@pitchcrew/core';
import { type BaseSkill } from '@pitchcrew/core/base-skills';

export type SkillEditorModel = NonNullable<ReturnType<typeof useSkillEditor>>;
export interface SkillEditorProps {
  skill: Skill | null;
  creator: string;
  roles: Role[];
  initialRole: RoleId | null;
  importing: boolean;
  starter: BaseSkill | null;
  action: Action;
  working: boolean;
  onClose: () => void;
}

export type SkillAssignmentProps = Pick<
  SkillEditorModel,
  'scope' | 'setScope' | 'roles' | 'roleIds' | 'setRoleIds'
>;

export type SkillDetailsProps = Pick<
  SkillEditorModel,
  'source' | 'importing' | 'creator' | 'name' | 'setName' | 'description' | 'setDescription'
>;

export type SkillEditorFooterProps = Pick<
  SkillEditorModel,
  'error' | 'working' | 'onClose' | 'loading' | 'skill'
>;

export type SkillEditorHeadingProps = Pick<
  SkillEditorModel,
  'skill' | 'importing' | 'working' | 'onClose'
>;

export type SkillImportProps = Pick<
  SkillEditorModel,
  'url' | 'setUrl' | 'loading' | 'working' | 'loadSkill' | 'skill' | 'starter'
>;

export type SkillInstructionsProps = Pick<SkillEditorModel, 'content' | 'setContent' | 'source'>;
