import type { Card } from './cards.ts';
import type { ChatMessage } from './chat.ts';
import type { ComputerApproval } from './computer.ts';
import type { Role, RoleProposal } from './roles.ts';
import type { AgentTask, Run } from './runs.ts';
import type { Skill, SkillProposal } from './skills.ts';
import type { Approval } from './workspace.ts';

export interface BoardEvent {
  id: number;
  version: 1 | 2 | 3 | 4 | 5 | 6;
  kind:
    | 'card'
    | 'role'
    | 'run'
    | 'approval'
    | 'message'
    | 'proposal'
    | 'task'
    | 'skill'
    | 'skill_proposal'
    | 'computer_approval';
  entityId: string;
  actor: string;
  message: string;
  data:
    | Card
    | Role
    | Run
    | Approval
    | ChatMessage
    | RoleProposal
    | AgentTask
    | Skill
    | SkillProposal
    | ComputerApproval;
  createdAt: string;
}
export function decodeEvent(raw: string): BoardEvent {
  const event = JSON.parse(raw) as BoardEvent;
  if (
    event.version !== 1 &&
    event.version !== 2 &&
    event.version !== 3 &&
    event.version !== 4 &&
    event.version !== 5 &&
    event.version !== 6
  )
    throw new Error(`Unsupported event version: ${event.version}`);
  return event;
}
