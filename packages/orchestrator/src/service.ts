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
import { access, mkdir } from 'node:fs/promises';
import { createCrewContext } from './crew/context.ts';
import type { CrewContext } from './crew/types.ts';
import { decideProfileProposal } from './profile-sources/proposals.ts';
import { assertProfileReady, changeProfile } from './profile-sources/mutation.ts';
import { updatePipelineReview } from './crew/pipeline/reviews.ts';

import { deleteRoutine, routines, saveRoutine } from './crew/routines/index.ts';
import { startScheduler, tickRoutines } from './crew/routines/scheduler.ts';

/** Public workspace API. Feature modules own the implementation and shared run context. */
export class CrewService {
  private readonly context: CrewContext;
  constructor(
    readonly directory: string,
    readonly daemonUrl: string,
    readonly mcpEntry: string,
    dev = false,
  ) {
    this.context = createCrewContext(directory, daemonUrl, mcpEntry, dev);
  }
  get board() {
    return this.context.board;
  }
  get onboarding() {
    return this.context.onboarding;
  }
  get connectors() {
    return this.context.connectors;
  }
  get profileSources() {
    return this.context.profileSources;
  }
  get jobSources() {
    return this.context.jobSources;
  }
  scanJobSources(input: unknown) {
    return this.context.jobSources.scan({ actor: 'user', input });
  }
  importProfileSource(input: unknown): Promise<ProfileFile[]> {
    assertProfileReady(this.context);
    return changeProfile(this.context, () => this.profileSources.import(input));
  }
  unlinkProfileSource(id: string): Promise<void> {
    assertProfileReady(this.context);
    return changeProfile(this.context, () => this.profileSources.unlink(id), true);
  }
  watchProfileProject(input: unknown) {
    assertProfileReady(this.context);
    return changeProfile(this.context, () => this.profileSources.watchProject(input));
  }
  setProfileSourceWatching(id: string, watching: boolean) {
    return changeProfile(this.context, () => this.profileSources.setWatching(id, watching), true);
  }
  decideProfileProposal(id: string, input: unknown) {
    return decideProfileProposal(this.context, id, input);
  }
  get computer() {
    return this.context.computer;
  }
  get capabilities() {
    return this.context.capabilities;
  }
  get controllers() {
    return this.context.controllers;
  }
  get runtimes() {
    return this.context.runtimes;
  }
  chatState(): ChatStreamState {
    return this.context.chatState();
  }
  chatUpdate(includeMessages: boolean): ChatStreamUpdate {
    return this.context.chatUpdate(includeMessages);
  }
  subscribeChat(listener: (messagesChanged: boolean) => void): () => void {
    return this.context.subscribeChat(listener);
  }
  initialize(seedSkills?: boolean): Promise<void> {
    return this.context.initialize(seedSkills);
  }
  detect(): Promise<RuntimeInfo[]> {
    return this.context.detect();
  }
  runtimeModels(id: RuntimeId, refresh?: boolean): Promise<RuntimeModelCatalog> {
    return this.context.runtimeModels(id, refresh);
  }
  snapshot(): Promise<Snapshot> {
    return this.context.snapshot();
  }
  routines() {
    return routines.call(this.context);
  }
  saveRoutine(data: unknown, id?: string) {
    return saveRoutine.call(this.context, data, id);
  }
  deleteRoutine(id: string) {
    return deleteRoutine.call(this.context, id);
  }
  startScheduler(): void {
    startScheduler.call(this.context);
  }
  tickRoutines(now?: Date): Promise<void> {
    return tickRoutines.call(this.context, now);
  }
  skills(roleId?: RoleId): Skill[] {
    return this.context.skills(roleId);
  }
  seedStarterSkills(): Promise<Snapshot['starterSkillErrors']> {
    return this.context.seedStarterSkills();
  }
  previewSkill(url: string): Promise<SkillPreview> {
    return this.context.previewSkill(url);
  }
  saveSkill(data: unknown, id?: string, actor?: 'user' | 'system'): Skill {
    return this.context.saveSkill(data, id, actor);
  }
  deleteSkill(id: string): { ok: boolean } {
    return this.context.deleteSkill(id);
  }
  writeRole(role: Role): Promise<void> {
    return this.context.writeRole(role);
  }
  createRole(data: unknown): Promise<Role> {
    return this.context.createRole(data);
  }
  retireRole(id: RoleId): Promise<Role> {
    return this.context.retireRole(id);
  }
  configureRole(id: RoleId, data: unknown): Promise<Role> {
    return this.context.configureRole(id, data);
  }
  createCard(data: unknown): Card {
    return this.context.createCard(data);
  }
  moveCard(id: string, state: CardState): Card {
    return this.context.moveCard(id, state);
  }
  saveProfile(name: string, content: string): Promise<ProfileFile[]> {
    return this.context.saveProfile(name, content);
  }
  loadExamples(): Promise<void> {
    return this.context.loadExamples();
  }
  startRun(cardId: string, roleId: RoleId, task?: AgentTask): Promise<Run> {
    return this.context.startRun(cardId, roleId, task);
  }
  applyResult(
    cardId: string,
    role: Role,
    data: unknown,
    profile?: ProfileFile[],
    signal?: AbortSignal,
  ): Promise<void> {
    return this.context.applyResult(cardId, role, data, profile, signal);
  }
  cancelRun(id: string): void {
    return this.context.cancelRun(id);
  }
  addMessage(
    threadId: ChatMessage['threadId'],
    from: ChatMessage['from'],
    to: ChatMessage['to'],
    content: string,
    cardId: string | null,
    runId: string | null,
    id?: string,
  ): ChatMessage {
    return this.context.addMessage(threadId, from, to, content, cardId, runId, id);
  }
  sendChat(roleId: RoleId, data: unknown): Promise<Run> {
    return this.context.sendChat(roleId, data);
  }
  updatePipelineReview(input: unknown) {
    return updatePipelineReview(this.context, input, 'user');
  }
  decideProposal(id: string, approved: boolean): Promise<RoleProposal> {
    return this.context.decideProposal(id, approved);
  }
  decideSkillProposal(id: string, approved: boolean): SkillProposal {
    return this.context.decideSkillProposal(id, approved);
  }
  exportPacket(id: string): Promise<string> {
    return this.context.exportPacket(id);
  }
  agentCall(
    token: string,
    action: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.context.agentCall(token, action, data);
  }
  close(): Promise<void> {
    return this.context.close();
  }
}
export async function ensureDirectory(directory: string) {
  await mkdir(directory, { recursive: true });
  await access(directory);
}
