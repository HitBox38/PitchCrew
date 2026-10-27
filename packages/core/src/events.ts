import type { WritingGuide, WritingCorrection, CareerPlan } from './application-quality.ts';
import type { DeepReview, ReviewSubagent } from './deep-reviews.ts';
import type { WorkQueue, QueueSettings } from './work-queue.ts';
import type { UserInputRequest } from './user-input.ts';
import type {
  Conversation,
  ChatRequest,
  AgentMemory,
  ConversationSession,
} from './conversations.ts';
import type { ProfileMaintenanceProposal } from './profile-maintenance.ts';
import type { FormAssessment, SubmissionAttempt } from './submissions.ts';
import type { PipelineReview } from './pipeline-reviews.ts';
import type { Card } from './cards.ts';
import type { ChatMessage } from './chat.ts';
import type { ComputerApproval, BrowserSitePermission } from './computer.ts';
import type { Role, RoleProposal } from './roles.ts';
import type { AgentTask, Run } from './runs.ts';
import type { Routine } from './routines.ts';
import type { Skill, SkillProposal } from './skills.ts';
import type { Approval } from './workspace.ts';
import type { TrackingSignal, TrackingScan } from './tracking.ts';
export const decodeEvent = (raw: string): BoardEvent => {
  const event = JSON.parse(raw) as BoardEvent;
  if (
    event.version !== 1 &&
    event.version !== 2 &&
    event.version !== 3 &&
    event.version !== 4 &&
    event.version !== 5 &&
    event.version !== 6 &&
    event.version !== 7 &&
    event.version !== 8 &&
    event.version !== 9 &&
    event.version !== 10 &&
    event.version !== 11 &&
    event.version !== 12 &&
    event.version !== 13 &&
    event.version !== 14 &&
    event.version !== 15 &&
    event.version !== 16 &&
    event.version !== 17 &&
    event.version !== 18 &&
    event.version !== 19 &&
    event.version !== 20 &&
    event.version !== 21 &&
    event.version !== 22 &&
    event.version !== 23 &&
    event.version !== 24 &&
    event.version !== 25 &&
    event.version !== 26 &&
    event.version !== 27
  )
    throw new Error(`Unsupported event version: ${event.version}`);
  return event;
};

export interface BoardEvent {
  id: number;
  version:
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 12
    | 13
    | 14
    | 15
    | 16
    | 17
    | 18
    | 19
    | 20
    | 21
    | 22
    | 23
    | 24
    | 25
    | 26
    | 27;
  kind:
    | 'writing_guide'
    | 'writing_correction'
    | 'career_plan'
    | 'work_queue'
    | 'queue_settings'
    | 'deep_review'
    | 'review_subagent'
    | 'user_input'
    | 'conversation_session'
    | 'conversation'
    | 'chat_request'
    | 'agent_memory'
    | 'pipeline_review'
    | 'card'
    | 'role'
    | 'run'
    | 'approval'
    | 'message'
    | 'proposal'
    | 'task'
    | 'routine'
    | 'tracking_signal'
    | 'tracking_scan'
    | 'skill'
    | 'skill_proposal'
    | 'computer_approval'
    | 'browser_site_permission'
    | 'profile_proposal'
    | 'form_assessment'
    | 'submission_attempt';
  entityId: string;
  actor: string;
  message: string;
  data:
    | WritingGuide
    | WritingCorrection
    | CareerPlan
    | WorkQueue
    | QueueSettings
    | DeepReview
    | ReviewSubagent
    | UserInputRequest
    | ConversationSession
    | Conversation
    | ChatRequest
    | AgentMemory
    | PipelineReview
    | Card
    | Role
    | Run
    | Approval
    | ChatMessage
    | RoleProposal
    | AgentTask
    | Routine
    | TrackingSignal
    | TrackingScan
    | Skill
    | SkillProposal
    | ComputerApproval
    | BrowserSitePermission
    | ProfileMaintenanceProposal
    | FormAssessment
    | SubmissionAttempt;
  createdAt: string;
}
/** Version 27 adds advisory packet-to-job ratings and queued whole-packet reevaluations. */
export const currentEventVersion = 27 as const;
