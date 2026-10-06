import { Board } from '@pitchcrew/board';
import { InstructionUpdatePreferences } from '../instruction-updates.ts';
import { OnboardingPreferences } from '../onboarding.ts';
import { PacketRulesStore } from '../packet-rules.ts';
import {
  type ChatMessage,
  type RoleId,
  type RuntimeId,
  type RuntimeModelCatalog,
} from '@pitchcrew/core';
import { ComputerManager } from '@pitchcrew/mcp/computer';
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
import { createRole, retireRole, configureRole, writeRole, writeRunInstructions } from './roles.ts';
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

export function createCrewContext(
  directory: string,
  daemonUrl: string,
  mcpEntry: string,
  dev = false,
): CrewContext {
  const onboarding = new OnboardingPreferences(directory);
  const board = new Board(join(directory, 'pitchcrew.db'));
  const connectors = new ConnectorManager(directory);
  const context: CrewContext = {
    directory,
    dev,
    daemonUrl,
    mcpEntry,
    board,
    onboarding,
    instructionUpdatePreferences: new InstructionUpdatePreferences(directory),
    packetRules: new PacketRulesStore(directory),
    connectors,
    profileSources: new ProfileSourceManager(directory, connectors),
    jobSources: new JobSourceManager(directory, board),
    profileWriting: false,
    profileRevision: 0,
    computer: new ComputerManager(board, directory),
    capabilities: new Map<string, { runId: string; cardId: string | null; roleId: RoleId }>(),
    controllers: new Map<string, AbortController>(),
    streamingMessages: new Map<string, ChatMessage>(),
    chatListeners: new Set<(messagesChanged: boolean) => void>(),
    draining: false,
    scheduling: false,
    drainAgain: false,
    closing: false,
    configuring: new Set<RoleId>(),
    deciding: new Set<string>(),
    runtimes: [],
    modelCatalogs: new Map<RuntimeId, { catalog: RuntimeModelCatalog; expiresAt: number }>(),
    modelRequests: new Map<RuntimeId, Promise<RuntimeModelCatalog>>(),
    modelController: new AbortController(),
    starterSkillErrors: [],
    starterRequest: undefined,
    chatState: (...args) => chatState.call(context, ...args),
    chatUpdate: (...args) => chatUpdate.call(context, ...args),
    subscribeChat: (...args) => subscribeChat.call(context, ...args),
    publishChat: (...args) => publishChat.call(context, ...args),
    initialize: (...args) => initialize.call(context, ...args),
    detect: (...args) => detect.call(context, ...args),
    runtimeModels: (...args) => runtimeModels.call(context, ...args),
    snapshot: (...args) => snapshot.call(context, ...args),
    skills: (...args) => skills.call(context, ...args),
    hasStarterSkill: (...args) => hasStarterSkill.call(context, ...args),
    seedStarterSkills: (...args) => seedStarterSkills.call(context, ...args),
    previewSkill: (...args) => previewSkill.call(context, ...args),
    saveSkill: (...args) => saveSkill.call(context, ...args),
    deleteSkill: (...args) => deleteSkill.call(context, ...args),
    writeRunInstructions: (...args) => writeRunInstructions.call(context, ...args),
    writeRole: (...args) => writeRole.call(context, ...args),
    createRole: (...args) => createRole.call(context, ...args),
    retireRole: (...args) => retireRole.call(context, ...args),
    configureRole: (...args) => configureRole.call(context, ...args),
    createCard: (...args) => createCard.call(context, ...args),
    moveCard: (...args) => moveCard.call(context, ...args),
    saveProfile: (...args) => saveProfile.call(context, ...args),
    loadExamples: (...args) => loadExamples.call(context, ...args),
    startRun: (...args) => startRun.call(context, ...args),
    applyResult: (...args) => applyResult.call(context, ...args),
    cancelRun: (...args) => cancelRun.call(context, ...args),
    addMessage: (...args) => addMessage.call(context, ...args),
    sendChat: (...args) => sendChat.call(context, ...args),
    startChatRun: (...args) => startChatRun.call(context, ...args),
    decideProposal: (...args) => decideProposal.call(context, ...args),
    decideSkillProposal: (...args) => decideSkillProposal.call(context, ...args),
    enqueue: (...args) => enqueue.call(context, ...args),
    finishTask: (...args) => finishTask.call(context, ...args),
    taskPermissionsAllow: (...args) => taskPermissionsAllow.call(context, ...args),
    drainTasks: (...args) => drainTasks.call(context, ...args),
    exportPacket: (...args) => exportPacket.call(context, ...args),
    agentCall: (...args) => agentCall.call(context, ...args),
    close: (...args) => close.call(context, ...args),
  };
  if (dev) context.board.seedRoles('demo', true);
  return context;
}
