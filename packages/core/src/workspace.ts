import type { ProfileMaintenanceProposal } from './profile-maintenance.ts';
import type { OnboardingState } from './onboarding.ts';
import type { PipelineReview } from './pipeline-reviews.ts';
import type { Card } from './cards.ts';
import type { ChatMessage } from './chat.ts';
import type { ComputerApproval } from './computer.ts';
import type { BoardEvent } from './events.ts';
import type { Packet, PacketArtifact } from './packets.ts';
import type { Role, RoleProposal } from './roles.ts';
import type { AgentTask, Run } from './runs.ts';
import type { Routine } from './routines.ts';
import type { RuntimeInfo } from './runtime.ts';
import type { Skill, SkillProposal } from './skills.ts';
import type { TrackingSignal, TrackingScan } from './tracking.ts';

export interface Approval {
  id: string;
  cardId: string;
  action: 'export_packet';
  digest: string;
  packet: Packet;
  status: 'pending' | 'approved' | 'rejected' | 'consumed';
  createdAt: string;
  decidedAt: string | null;
  exportDirectory?: string;
  artifacts?: PacketArtifact[];
  artifactDigest?: string;
}
export interface ProfileFile {
  name: string;
  content: string;
}
export interface Snapshot {
  onboarding?: OnboardingState;
  profileProposals?: ProfileMaintenanceProposal[];
  trackingSignals?: TrackingSignal[];
  trackingScans?: TrackingScan[];
  starterSkillErrors: { name: string; error: string }[];
  cards: Card[];
  roles: Role[];
  skills: Skill[];
  skillProposals: SkillProposal[];
  runs: Run[];
  approvals: Approval[];
  computerApprovals: ComputerApproval[];
  events: BoardEvent[];
  profile: ProfileFile[];
  runtimes: RuntimeInfo[];
  dataDirectory: string;
  demoAvailable: boolean;
  messages: ChatMessage[];
  streamingMessages: ChatMessage[];
  proposals: RoleProposal[];
  pipelineReviews?: PipelineReview[];
  tasks: AgentTask[];
  routines: Routine[];
  connectors: ConnectorStatus[];
}
export interface ConnectorStatus {
  id: 'github' | 'google';
  connected: boolean;
  account: string;
  services: string[];
  configured: boolean;
  pending: boolean;
  error: string;
  connectionMethod?: 'cli' | 'token';
  githubCliState?: 'missing' | 'signed_out' | 'ready' | 'account_changed';
}
