import {
  type PipelineReview,
  type AgentTask,
  type Approval,
  type Card,
  type ChatMessage,
  type ComputerApproval,
  type Role,
  type RoleProposal,
  type Run,
  type SkillProposal,
  type Snapshot,
  type TrackingSignal,
  type TrackingScan,
} from '@pitchcrew/core';
import { readProfile } from '@pitchcrew/packet';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { CrewContext } from './types.ts';
import { routines } from './routines/index.ts';

export async function initialize(this: CrewContext, seedSkills: boolean = true): Promise<void> {
  await this.connectors.initialize();
  for (const approval of this.board
    .list<ComputerApproval>('computer_approval')
    .filter((a) => ['pending', 'approved'].includes(a.status)))
    this.board.record(
      'computer_approval',
      {
        ...approval,
        status: 'rejected',
        error: 'The daemon restarted; browser approval expired.',
      },
      'system',
      'Expired interrupted browser action',
    );
  for (const folder of ['profile', 'roles', 'packets'])
    await mkdir(join(this.directory, folder), { recursive: true });
  for (const run of this.board.list<Run>('run').filter((r) => r.status === 'running')) {
    this.board.record(
      'run',
      {
        ...run,
        status: 'failed',
        message: 'The daemon stopped during this run. Retry the role.',
        finishedAt: new Date().toISOString(),
      },
      'system',
      'Recovered interrupted run',
    );
    if (!run.cardId || run.mode === 'chat') continue;
    const card = this.board.get<Card>('card', run.cardId);
    if (card.owner)
      this.board.updateCard(card.id, { owner: null }, 'system', 'Released interrupted run');
    if (card.state === 'drafting')
      this.board.move(card.id, 'changes_requested', 'system', 'Draft interrupted; retry writer');
  }
  for (const task of this.board
    .list<AgentTask>('task')
    .filter((t) => ['queued', 'running'].includes(t.status)))
    this.board.record(
      'task',
      {
        ...task,
        status: 'failed',
        error: 'The daemon stopped. Start a new conversation to retry.',
      },
      'system',
      'Recovered interrupted crew task',
    );
  for (const role of this.board.list<Role>('role')) await this.writeRole(role);
  if (seedSkills) await this.seedStarterSkills();
  await this.detect();
}
export async function snapshot(this: CrewContext): Promise<Snapshot> {
  // Finish filesystem reads before collecting board state, so no run can advance between entities.
  const profile = await readProfile(this.directory);
  return {
    onboarding: this.onboarding.get(),
    packetRules: this.packetRules.current(),
    trackingSignals: this.board.list<TrackingSignal>('tracking_signal'),
    trackingScans: this.board.list<TrackingScan>('tracking_scan'),
    cards: this.board.list<Card>('card'),
    roles: this.board.list<Role>('role'),
    skills: this.skills(),
    starterSkillErrors: this.starterSkillErrors,
    skillProposals: this.board.list<SkillProposal>('skill_proposal'),
    runs: this.board.list<Run>('run').slice(-50).reverse(),
    approvals: this.board.list<Approval>('approval').reverse(),
    computerApprovals: this.board.list<ComputerApproval>('computer_approval').reverse(),
    events: this.board.events(),
    profileProposals: this.board.list('profile_proposal'),
    profile,
    runtimes: this.runtimes,
    dataDirectory: this.directory,
    demoAvailable: this.dev && !this.board.list<Card>('card').some((c) => c.sample),
    messages: this.board.list<ChatMessage>('message'),
    streamingMessages: [...this.streamingMessages.values()],
    proposals: this.board.list<RoleProposal>('proposal'),
    pipelineReviews: this.board.list<PipelineReview>('pipeline_review').reverse(),
    tasks: this.board.list<AgentTask>('task'),
    routines: routines.call(this),
    connectors: this.connectors.status(),
  };
}
export async function close(this: CrewContext): Promise<void> {
  this.closing = true;
  clearInterval(this.schedulerTimer);
  this.modelController.abort();
  this.jobSources.close();
  for (const controller of this.controllers.values()) controller.abort();
  await Promise.allSettled(this.modelRequests.values());
  await this.connectors.close();
  await this.computer.close();
  for (let i = 0; i < 100 && (this.controllers.size || this.draining || this.scheduling); i++)
    await new Promise((resolve) => setTimeout(resolve, 25));
  if (this.controllers.size || this.draining || this.scheduling)
    throw new Error('Some runs did not stop in time.');
  this.board.close();
}
