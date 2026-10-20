import { RuntimeMaintenance } from '../runtime-maintenance/index.ts';
import { Board } from '@pitchcrew/board';
import { writingGuide, saveGuide } from '../quality/writing.ts';
import { ProfileOrganizationStore } from '../profile-organization.ts';
import { InstructionUpdatePreferences } from '../instruction-updates.ts';
import { SkillUpdateChecks } from '../skill-update-checks/index.ts';
import { OnboardingPreferences } from '../onboarding.ts';
import { PacketRulesStore } from '../packet-rules.ts';
import {
  type ChatMessage,
  type RoleId,
  type RuntimeId,
  type RuntimeModelCatalog,
} from '@pitchcrew/core';
import { type BrowserDriver, ComputerManager } from '@pitchcrew/mcp/computer';
import { ConnectorManager } from '@pitchcrew/mcp/connectors';
import { join } from 'node:path';
import { ProfileSourceManager } from '../profile-sources/index.ts';
import { JobSourceManager } from '../job-sources/index.ts';
import { createCard, exportPacket, loadExamples, moveCard, saveProfile } from './cards.ts';
import {
  addMessage,
  chatState,
  chatUpdate,
  publishChat,
  sendChat,
  startChatRun,
  subscribeChat,
} from './chat.ts';
import { agentCall } from './gateway.ts';
import { close, initialize, snapshot } from './lifecycle.ts';
import { detect, runtimeModels } from './models.ts';
import { decideProposal, decideSkillProposal } from './proposals.ts';
import {
  createRole,
  retireRole,
  restoreRole,
  configureRole,
  writeRole,
  writeRunInstructions,
} from './roles.ts';
import {
  deleteSkill,
  hasStarterSkill,
  previewSkill,
  saveSkill,
  seedStarterSkills,
  skills,
} from './skills.ts';
import { drainTasks, enqueue, finishTask, taskPermissionsAllow } from './tasks.ts';
import type { CrewContext } from './types.ts';
import { applyResult, cancelRun, startRun } from './workflow.ts';

export const createCrewContext = (
  directory: string,
  daemonUrl: string,
  mcpEntry: string,
  dev = false,
  browserLaunch?: (profile?: string) => Promise<BrowserDriver>,
  diagnostics?: import('@pitchcrew/core').DiagnosticSink,
): CrewContext => {
  const onboarding = new OnboardingPreferences(directory);
  const board = new Board(join(directory, 'pitchcrew.db'));
  const connectors = new ConnectorManager(directory);
  const context: CrewContext = {
    diagnostics,
    directory,
    dev,
    daemonUrl,
    mcpEntry,
    board,
    queueChains: new Map(),
    queueReservations: new Map(),
    deepReviewExecutions: new Map(),
    onboarding,
    instructionUpdatePreferences: new InstructionUpdatePreferences(directory),
    skillUpdateChecks: new SkillUpdateChecks(directory),
    packetRules: new PacketRulesStore(directory),
    connectors,
    profileSources: new ProfileSourceManager(directory, connectors),
    profileOrganization: new ProfileOrganizationStore(directory),
    jobSources: new JobSourceManager(directory, board),
    profileWriting: false,
    profileRevision: 0,
    computer: new ComputerManager(board, directory, browserLaunch),
    capabilities: new Map<string, { runId: string; cardId: string | null; roleId: RoleId }>(),
    controllers: new Map<string, AbortController>(),
    streamingMessages: new Map<string, ChatMessage>(),
    runActivities: new Map(),
    chatListeners: new Set<(messagesChanged: boolean) => void>(),
    draining: false,
    scheduling: false,
    drainAgain: false,
    closing: false,
    initializing: false,
    configuring: new Set<RoleId>(),
    deciding: new Set<string>(),
    runtimes: [],
    runtimeMaintenance: new RuntimeMaintenance(directory, () => context),
    modelCatalogs: new Map<RuntimeId, { catalog: RuntimeModelCatalog; expiresAt: number }>(),
    modelRequests: new Map<RuntimeId, Promise<RuntimeModelCatalog>>(),
    modelController: new AbortController(),
    starterSkillErrors: [],
    starterRequest: undefined,
    chatState: (...args) => chatState(context, ...args),
    chatUpdate: (...args) => chatUpdate(context, ...args),
    subscribeChat: (...args) => subscribeChat(context, ...args),
    publishChat: (...args) => publishChat(context, ...args),
    initialize: (...args) => initialize(context, ...args),
    detect: (...args) => detect(context, ...args),
    runtimeModels: (...args) => runtimeModels(context, ...args),
    snapshot: (...args) => snapshot(context, ...args),
    skills: (...args) => skills(context, ...args),
    hasStarterSkill: (...args) => hasStarterSkill(context, ...args),
    seedStarterSkills: (...args) => seedStarterSkills(context, ...args),
    previewSkill: (...args) => previewSkill(context, ...args),
    saveSkill: (...args) => saveSkill(context, ...args),
    deleteSkill: (...args) => deleteSkill(context, ...args),
    writeRunInstructions: (...args) => writeRunInstructions(context, ...args),
    writeRole: (...args) => writeRole(context, ...args),
    createRole: (...args) => createRole(context, ...args),
    retireRole: (...args) => retireRole(context, ...args),
    restoreRole: (...args) => restoreRole(context, ...args),
    configureRole: (...args) => configureRole(context, ...args),
    createCard: (...args) => createCard(context, ...args),
    moveCard: (...args) => moveCard(context, ...args),
    saveProfile: (...args) => saveProfile(context, ...args),
    loadExamples: (...args) => loadExamples(context, ...args),
    startRun: (...args) => startRun(context, ...args),
    applyResult: (...args) => applyResult(context, ...args),
    cancelRun: (...args) => cancelRun(context, ...args),
    addMessage: (...args) => addMessage(context, ...args),
    sendChat: (...args) => sendChat(context, ...args),
    startChatRun: (...args) => startChatRun(context, ...args),
    decideProposal: (...args) => decideProposal(context, ...args),
    decideSkillProposal: (...args) => decideSkillProposal(context, ...args),
    enqueue: (...args) => enqueue(context, ...args),
    finishTask: (...args) => finishTask(context, ...args),
    taskPermissionsAllow: (...args) => taskPermissionsAllow(context, ...args),
    drainTasks: (...args) => drainTasks(context, ...args),
    exportPacket: (...args) => exportPacket(context, ...args),
    agentCall: (...args) => agentCall(context, ...args),
    close: (...args) => close(context, ...args),
  };
  if (!board.list('writing_guide').length) saveGuide(context, writingGuide(context), 'system');
  if (dev) context.board.seedRoles('demo', true);
  return context;
};
