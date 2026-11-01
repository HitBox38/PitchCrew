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
  /** Receives a newly created skill's ID so the library can select it. */
  onSaved: (id: string) => void;
  onBack: () => void;
  /** The library calls the registered guard before replacing this draft. */
  registerLeave: (guard: ((next: () => void) => void) | null) => void;
}
