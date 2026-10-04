import { Board } from '@pitchcrew/board';
import type { OnboardingPreferences } from '../onboarding.ts';
import type { PacketRulesStore } from '../packet-rules.ts';
import type { SkillPreview } from '@pitchcrew/core';
import {
  type AgentTask,
  type Card,
  type CardState,
  type ChatMessage,
  type ChatStreamState,
  type ChatStreamUpdate,
  type ProfileFile,
  type Role,
  type RoleId,
  type RoleProposal,
  type Run,
  type RuntimeId,
  type RuntimeInfo,
  type RuntimeModelCatalog,
  type Skill,
  type SkillProposal,
  type Snapshot,
} from '@pitchcrew/core';
import { type BaseSkill } from '@pitchcrew/core/base-skills';
import { ComputerManager } from '@pitchcrew/mcp/computer';
import { ConnectorManager } from '@pitchcrew/mcp/connectors';
import type { ProfileSourceManager } from '../profile-sources/index.ts';
import type { JobSourceManager } from '../job-sources/index.ts';

/** Shared run state. Internal to the orchestrator; never exposed to runtime adapters. */
export interface CrewContext {
  readonly directory: string;
  readonly dev: boolean;
  readonly daemonUrl: string;
  readonly mcpEntry: string;
  board: Board;
  onboarding: OnboardingPreferences;
  packetRules: PacketRulesStore;
  connectors: ConnectorManager;
  profileSources: ProfileSourceManager;
  jobSources: JobSourceManager;
  profileWriting: boolean;
  profileRevision: number;
  computer: ComputerManager;
  capabilities: Map<string, { runId: string; cardId: string | null; roleId: RoleId }>;
  controllers: Map<string, AbortController>;
  streamingMessages: Map<string, ChatMessage>;
  chatListeners: Set<(messagesChanged: boolean) => void>;
  draining: boolean;
  scheduling: boolean;
  schedulerTimer?: ReturnType<typeof setInterval>;
  drainAgain: boolean;
  closing: boolean;
  configuring: Set<RoleId>;
  deciding: Set<string>;
  runtimes: RuntimeInfo[];
  modelCatalogs: Map<RuntimeId, { catalog: RuntimeModelCatalog; expiresAt: number }>;
  modelRequests: Map<RuntimeId, Promise<RuntimeModelCatalog>>;
  modelController: AbortController;
  starterSkillErrors: Snapshot['starterSkillErrors'];
  starterRequest?: Promise<Snapshot['starterSkillErrors']>;
  chatState(): ChatStreamState;
  chatUpdate(includeMessages: boolean): ChatStreamUpdate;
  subscribeChat(listener: (messagesChanged: boolean) => void): () => void;
  publishChat(messagesChanged?: boolean): void;
  initialize(seedSkills?: boolean): Promise<void>;
  detect(): Promise<RuntimeInfo[]>;
  runtimeModels(id: RuntimeId, refresh?: boolean): Promise<RuntimeModelCatalog>;
  snapshot(): Promise<Snapshot>;
  skills(roleId?: RoleId): Skill[];
  hasStarterSkill(starter: BaseSkill): boolean;
  seedStarterSkills(): Promise<Snapshot['starterSkillErrors']>;
  previewSkill(url: string): Promise<SkillPreview>;
  saveSkill(data: unknown, id?: string, actor?: 'user' | 'system'): Skill;
  deleteSkill(id: string): { ok: boolean };
  writeRunInstructions(dir: string, role: Role, skills: Skill[]): Promise<void>;
  writeRole(role: Role): Promise<void>;
  createRole(data: unknown): Promise<Role>;
  retireRole(id: RoleId): Promise<Role>;
  configureRole(id: RoleId, data: unknown): Promise<Role>;
  createCard(data: unknown): Card;
  moveCard(id: string, state: CardState): Card;
  saveProfile(name: string, content: string): Promise<ProfileFile[]>;
  loadExamples(): Promise<void>;
  startRun(cardId: string, roleId: RoleId, task?: AgentTask): Promise<Run>;
  applyResult(
    cardId: string,
    role: Role,
    data: unknown,
    profile?: ProfileFile[],
    signal?: AbortSignal,
  ): Promise<void>;
  cancelRun(id: string): void;
  addMessage(
    threadId: ChatMessage['threadId'],
    from: ChatMessage['from'],
    to: ChatMessage['to'],
    content: string,
    cardId: string | null,
    runId: string | null,
    id?: string,
    notification?: ChatMessage['notification'],
  ): ChatMessage;
  sendChat(roleId: RoleId, data: unknown): Promise<Run>;
  startChatRun(
    roleId: RoleId,
    content: string,
    cardId: string | null,
    threadId: ChatMessage['threadId'],
    task?: AgentTask,
    scheduled?: { routineId: string; scheduledFor: string },
  ): Promise<Run>;
  decideProposal(id: string, approved: boolean): Promise<RoleProposal>;
  decideSkillProposal(id: string, approved: boolean): SkillProposal;
  enqueue(
    capability: { runId: string; cardId: string | null; roleId: RoleId },
    roleId: RoleId,
    mode: AgentTask['mode'],
    content: string,
    trigger: AgentTask['trigger'],
  ): AgentTask;
  finishTask(run: Run): void;
  taskPermissionsAllow(task: AgentTask): boolean;
  drainTasks(): Promise<void>;
  exportPacket(id: string, assertActive?: () => void): Promise<string>;
  agentCall(
    token: string,
    action: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  close(): Promise<void>;
}

export interface RunCapability {
  runId: string;
  roleId: RoleId;
  cardId: string | null;
}
