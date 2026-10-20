import { workspaceQueue } from './queue/projection.ts';
import { ensureQueue, patchQueue } from './queue/state.ts';
import { workspaceCards, workspaceRuns, workspaceEvents } from './workspace-projection.ts';
import { workspaceMessages } from '@pitchcrew/board';
import { activityRuns } from './chat-activity.ts';
import { recordOperationalLog } from '../telemetry/logs.ts';
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
import { qualitySnapshot } from '../quality/snapshot.ts';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { CrewContext } from './types.ts';
import { migrateConversations, conversations } from './conversations.ts';
import { routines } from './routines/index.ts';
import { instructionUpdates } from './instruction-updates.ts';
import { seedRecommendedRoles } from './runtime-recommendations.ts';

export async function initialize(this: CrewContext, seedSkills: boolean = true): Promise<void> {
  this.initializing = true;
  const interruptedTasks: AgentTask[] = [];
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
      recordOperationalLog(this.diagnostics, { code: 'daemon_run_recovered', area: 'daemon' });
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
    for (const report of this.board
      .list<import('@pitchcrew/core').DeepReview>('deep_review')
      .filter((r) => r.status === 'running')) {
      const question = this.board
        .list<import('@pitchcrew/core').UserInputRequest>('user_input')
        .find(
          (q) =>
            q.status === 'pending' &&
            this.board.get<Run>('run', q.runId).deepReviewId === report.id,
        );
      const summary = question
        ? 'Waiting for your answer'
        : 'The daemon stopped during this deep review. Start a fresh review; completed work remains in history.';
      this.board.record(
        'deep_review',
        {
          ...report,
          status: question ? 'waiting' : 'failed',
          summary,
          error: question ? undefined : 'Interrupted by daemon restart.',
          currentPacketDigest: question
            ? this.board.get<Run>('run', question.runId).inputPacketDigest
            : report.currentPacketDigest,
          remainingMs: question
            ? Math.max(1000, Date.parse(report.deadlineAt) - Date.parse(question.createdAt))
            : undefined,
          finishedAt: question ? null : new Date().toISOString(),
        },
        'system',
        'Recovered interrupted deep review',
      );
      if (question) {
        const parent = this.board.get<Run>('run', report.runId);
        this.board.record(
          'run',
          { ...parent, status: 'waiting', message: summary },
          'system',
          summary,
        );
      }
    }
    for (const child of this.board
      .list<import('@pitchcrew/core').ReviewSubagent>('review_subagent')
      .filter((r) => r.status === 'running'))
      this.board.record(
        'review_subagent',
        {
          ...child,
          status: 'cancelled',
          error: 'Interrupted by daemon restart.',
          finishedAt: new Date().toISOString(),
        },
        'system',
        'Recovered interrupted review subagent',
      );
    for (const task of this.board
      .list<AgentTask>('task')
      .filter((t) => ['queued', 'running'].includes(t.status))) {
      const parent = this.board.get<Run>('run', task.runId ?? task.parentRunId);
      if (task.status === 'queued' && parent.status === 'completed') continue;
      const status = parent.status === 'waiting' ? (task.runId ? 'waiting' : 'queued') : 'failed';
      this.board.record(
        'task',
        {
          ...task,
          status,
          error: status === 'failed' ? 'The daemon stopped. Retry or skip this follow-up.' : '',
        },
        'system',
        'Recovered interrupted crew task',
      );
      if (status === 'failed') interruptedTasks.push(task);
    }
    const rolesReady = (async () => {
      await this.detect();
      await this.runtimeMaintenance.recover();
      await seedRecommendedRoles(this);
      await this.runtimeMaintenance.initializeAuthentication();
    })();
    // Public starter sources and CLI metadata can load together. Both must finish before the
    // daemon becomes ready; skill commits wait for role setup and recheck current assignments.
    await Promise.all([rolesReady, ...(seedSkills ? [this.seedStarterSkills(rolesReady)] : [])]);
    for (const role of this.board.list<Role>('role')) await this.writeRole(role);
    migrateConversations(this);
    for (const task of interruptedTasks) {
      const queue = ensureQueue(this, task.threadId, task.rootRunId);
      if (!queue.id.startsWith('routine:'))
        patchQueue(this, queue.id, {
          paused: true,
          pauseKind: 'interrupted',
          reason: 'Interrupted by daemon restart. Retry or skip this follow-up.',
        });
    }
    for (const request of this.board.list<import('@pitchcrew/core').ChatRequest>('chat_request')) {
      if (!request.deliveries.some((delivery) => ['queued', 'running'].includes(delivery.status)))
        continue;
      for (const delivery of request.deliveries)
        if (delivery.status === 'running')
          delivery.status =
            delivery.runId && this.board.get<Run>('run', delivery.runId).status === 'waiting'
              ? 'waiting'
              : 'paused';
      this.board.record('chat_request', request, 'system', 'Recovered saved user request');
      const queue = ensureQueue(this, request.threadId, request.rootRunId);
      if (request.deliveries.some((d) => d.status === 'paused' && d.runId))
        patchQueue(this, queue.id, {
          paused: true,
          pauseKind: 'interrupted',
          reason: 'Interrupted by daemon restart. Retry or skip this request.',
        });
    }
  } finally {
    this.initializing = false;
  }
}
export async function snapshot(
  this: CrewContext,
  options?: { workspace?: boolean },
): Promise<Snapshot> {
  // Finish filesystem reads before collecting board state, so no run can advance between entities.
  const profile = await readProfile(this.directory);
  migrateConversations(this);
  const snapshot: Snapshot = {
    quality: qualitySnapshot(this, profile),
    queue: workspaceQueue(this),
    userInputs: this.board.list('user_input'),
    conversations: conversations(this),
    chatRequests: this.board.list('chat_request'),
    memories: this.board
      .list<import('@pitchcrew/core').AgentMemory>('agent_memory')
      .filter((memory) => !memory.deleted),
    onboarding: this.onboarding.get(),
    packetRules: this.packetRules.current(),
    instructionUpdates: instructionUpdates(this),
    skillUpdates: this.skillUpdateChecks.current(this),
    trackingSignals: this.board.list<TrackingSignal>('tracking_signal'),
    trackingScans: this.board.list<TrackingScan>('tracking_scan'),
    cards: options?.workspace ? workspaceCards(this.board) : this.board.list<Card>('card'),
    roles: this.board.list<Role>('role'),
    skills: this.skills(),
    starterSkillErrors: this.starterSkillErrors,
    skillProposals: this.board.list<SkillProposal>('skill_proposal'),
    runs: options?.workspace ? workspaceRuns(this.board) : this.board.list<Run>('run').reverse(),
    approvals: this.board.list<Approval>('approval').reverse(),
    computerApprovals: this.board.list<ComputerApproval>('computer_approval').reverse(),
    events: options?.workspace ? workspaceEvents(this.board) : this.board.events(),
    profileProposals: this.board.list('profile_proposal'),
    profile,
    profileOrganization: this.profileOrganization.get(),
    runtimes: this.runtimes,
    runtimeMaintenance: this.runtimeMaintenance.current(),
    dataDirectory: this.directory,
    demoAvailable: this.dev && !this.board.list<Card>('card').some((c) => c.sample),
    ...(options?.workspace
      ? { workspace: true as const, ...workspaceMessages(this.board) }
      : { messages: this.board.list<ChatMessage>('message') }),
    streamingMessages: [...this.streamingMessages.values()],
    activityRuns: activityRuns(this),
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
  for (const run of this.board
    .list<Run>('run')
    .filter((r) => r.status === 'running' && r.threadId)) {
    const queue = ensureQueue(this, run.threadId!, run.rootRunId);
    if (!queue.id.startsWith('routine:'))
      patchQueue(this, queue.id, {
        paused: true,
        pauseKind: 'interrupted',
        reason: 'Interrupted when the daemon stopped. Retry or skip this request.',
      });
  }
  for (const controller of this.controllers.values()) controller.abort();
  await Promise.allSettled([
    ...this.modelRequests.values(),
    this.skillUpdateChecks.close(),
    this.runtimeMaintenance.close(),
    ...(this.starterRequest ? [this.starterRequest] : []),
  ]);
  await this.connectors.close();
  await this.computer.close();
  for (let i = 0; i < 100 && (this.controllers.size || this.draining || this.scheduling); i++)
    await new Promise((resolve) => setTimeout(resolve, 25));
  if (this.controllers.size || this.draining || this.scheduling)
    throw new Error('Some runs did not stop in time.');
  this.board.close();
}
