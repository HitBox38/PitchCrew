import { endQuestionTurn } from './user-input/lifecycle.ts';
import {
  type PipelineReview,
  type AgentTask,
  type Approval,
  type Card,
  type ChatMessage,
  type ComputerApproval,
  type ConversationSession,
  type Role,
  type RoleProposal,
  type Run,
  type SkillProposal,
  type Snapshot,
  type TrackingSignal,
  type TrackingScan,
} from '@pitchcrew/core';
import { artifactPages, readProfile } from '@pitchcrew/packet';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { CrewContext } from './types.ts';
import { migrateConversations, conversations } from './conversations.ts';
import { routines } from './routines/index.ts';
import { instructionUpdates } from './instruction-updates.ts';
import { seedRecommendedRoles } from './runtime-recommendations.ts';

export async function initialize(this: CrewContext, seedSkills: boolean = true): Promise<void> {
  this.initializing = true;
  try {
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
      for (const session of this.board.list<ConversationSession>('conversation_session'))
        if (session.threadId === run.threadId && session.roleId === run.roleId && !session.invalid)
          this.board.record(
            'conversation_session',
            { ...session, invalid: true },
            'system',
            'Invalidated interrupted runtime session',
          );
      if (!endQuestionTurn(this, run))
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
          status:
            this.board.get<Run>('run', task.runId ?? task.parentRunId).status === 'waiting'
              ? task.runId
                ? 'waiting'
                : 'queued'
              : 'failed',
          error:
            this.board.get<Run>('run', task.runId ?? task.parentRunId).status === 'waiting'
              ? ''
              : 'The daemon stopped. Start a new conversation to retry.',
        },
        'system',
        'Recovered interrupted crew task',
      );
    await this.detect();
    await seedRecommendedRoles(this);
    for (const role of this.board.list<Role>('role')) await this.writeRole(role);
    migrateConversations(this);
    for (const request of this.board.list<import('@pitchcrew/core').ChatRequest>('chat_request')) {
      if (!request.deliveries.some((delivery) => ['queued', 'running'].includes(delivery.status)))
        continue;
      for (const delivery of request.deliveries)
        if (['queued', 'running'].includes(delivery.status))
          delivery.status =
            delivery.runId && this.board.get<Run>('run', delivery.runId).status === 'waiting'
              ? 'waiting'
              : 'paused';
      this.board.record('chat_request', request, 'system', 'Paused interrupted user request');
    }
    if (seedSkills) await this.seedStarterSkills();
  } finally {
    this.initializing = false;
  }
}
export async function snapshot(this: CrewContext): Promise<Snapshot> {
  // Finish filesystem reads before collecting board state, so no run can advance between entities.
  const profile = await readProfile(this.directory);
  migrateConversations(this);
  const snapshot: Snapshot = {
    userInputs: this.board.list('user_input'),
    conversations: conversations(this),
    chatRequests: this.board.list('chat_request'),
    memories: this.board
      .list<import('@pitchcrew/core').AgentMemory>('agent_memory')
      .filter((memory) => !memory.deleted),
    onboarding: this.onboarding.get(),
    packetRules: this.packetRules.current(),
    instructionUpdates: instructionUpdates(this),
    trackingSignals: this.board.list<TrackingSignal>('tracking_signal'),
    trackingScans: this.board.list<TrackingScan>('tracking_scan'),
    cards: this.board.list<Card>('card'),
    roles: this.board.list<Role>('role'),
    skills: this.skills(),
    starterSkillErrors: this.starterSkillErrors,
    skillProposals: this.board.list<SkillProposal>('skill_proposal'),
    runs: this.board.list<Run>('run').reverse(),
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
  // Derived from the approvals collected above, after all board reads.
  const artifacts = snapshot.approvals.flatMap((approval) => approval.artifacts ?? []);
  return { ...snapshot, artifactPages: await artifactPages(artifacts) };
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
