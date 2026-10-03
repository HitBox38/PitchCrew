import type { Role, Snapshot } from '@pitchcrew/core';
import type { RoutineDraft } from '@/RoutinesPage/types.ts';
import type { useAgentCreation } from './hooks/useAgentCreation.ts';

export interface SkillReference {
  id: string;
  updatedAt: string;
}
export interface CreationDraft {
  role: Role;
  skills: SkillReference[];
  scheduled: boolean;
  routine: RoutineDraft;
}
export interface AgentCreationProps {
  data: Snapshot;
  working: boolean;
  onClose(): void;
  onCreated(role: Role): void;
}
export type CreationController = ReturnType<typeof useAgentCreation>;
export type StepProps = Pick<CreationController, 'draft' | 'changeRole' | 'changeDraft'> & {
  data: Snapshot;
};
