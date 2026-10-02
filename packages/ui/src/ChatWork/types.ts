import type { ChatThread } from '@/ChatView/types.ts';
import type { getChatWorkModel } from '@/ChatWork/helpers.ts';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { AgentTask, Role, RoleProposal, SkillProposal, Snapshot } from '@pitchcrew/core';

export interface ChatWorkProps {
  data: Snapshot;
  thread: ChatThread;
  role: Role;
  proposals: RoleProposal[];
  skillProposals: SkillProposal[];
  tasks: AgentTask[];
  action: Action;
  working: boolean;
  onConfigure: () => void;
  onOpenCard: (id: string) => void;
}
export type ChatWorkModel = NonNullable<ReturnType<typeof getChatWorkModel>>;

export type CrewTasksProps = Pick<
  ChatWorkModel,
  'tasks' | 'data' | 'name' | 'onOpenCard' | 'working' | 'act'
>;

export type InstructionComparisonProps = { proposal: RoleProposal; current: Role };

export type RoleCapabilitiesProps = Pick<ChatWorkModel, 'role' | 'onConfigure'>;

export type RoleProposalsProps = Pick<ChatWorkModel, 'proposals' | 'data' | 'working' | 'act'>;

export type SkillProposalsProps = Pick<
  ChatWorkModel,
  'skillProposals' | 'name' | 'working' | 'act'
>;

export type CapabilityChangesProps = {
  current: Role;
  changes: NonNullable<RoleProposal['changes']['capabilities']>;
};
