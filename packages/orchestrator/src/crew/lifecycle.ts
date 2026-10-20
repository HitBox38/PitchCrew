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

export const initialize = async (
  context: CrewContext,
  seedSkills: boolean = true,
): Promise<void> => {
  context.initializing = true;
  const interruptedTasks: AgentTask[] = [];
  try {
    await context.connectors.initialize();
    for (const approval of context.board
      .list<ComputerApproval>('computer_approval')
      .filter((a) => ['pending', 'approved'].includes(a.status)))
      context.board.record(
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
      await mkdir(join(context.directory, folder), { recursive: true });
    for (const run of context.board.list<Run>('run').filter((r) => r.status === 'running')) {
      recordOperationalLog(context.diagnostics, { code: 'daemon_run_recovered', area: 'daemon' });
      for (const session of context.board.list<ConversationSession>('conversation_session'))
        if (session.threadId === run.threadId && session.roleId === run.roleId && !session.invalid)
          context.board.record(
            'conversation_session',
            { ...session, invalid: true },
            'system',
            'Invalidated interrupted runtime session',
          );
      if (!endQuestionTurn(context, run))
        context.board.record(
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
      const card = context.board.get<Card>('card', run.cardId);
      if (card.owner)
        context.board.updateCard(card.id, { owner: null }, 'system', 'Released interrupted run');
      if (card.state === 'drafting')
        context.board.move(
          card.id,
          'changes_requested',
          'system',
          'Draft interrupted; retry writer',
        );
    }
    for (const report of context.board
      .list<import('@pitchcrew/core').DeepReview>('deep_review')
      .filter((r) => r.status === 'running')) {
      const question = context.board
        .list<import('@pitchcrew/core').UserInputRequest>('user_input')
        .find(
          (q) =>
            q.status === 'pending' &&
            context.board.get<Run>('run', q.runId).deepReviewId === report.id,
        );
      const summary = question
        ? 'Waiting for your answer'
        : 'The daemon stopped during this deep review. Start a fresh review; completed work remains in history.';
      context.board.record(
        'deep_review',
        {
          ...report,
          status: question ? 'waiting' : 'failed',
          summary,
          error: question ? undefined : 'Interrupted by daemon restart.',
          currentPacketDigest: question
            ? context.board.get<Run>('run', question.runId).inputPacketDigest
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
        const parent = context.board.get<Run>('run', report.runId);
        context.board.record(
          'run',
          { ...parent, status: 'waiting', message: summary },
          'system',
          summary,
        );
      }
    }
    for (const child of context.board
      .list<import('@pitchcrew/core').ReviewSubagent>('review_subagent')
      .filter((r) => r.status === 'running'))
      context.board.record(
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
    for (const task of context.board
      .list<AgentTask>('task')
      .filter((t) => ['queued', 'running'].includes(t.status))) {
      const parent = context.board.get<Run>('run', task.runId ?? task.parentRunId);
      if (task.status === 'queued' && parent.status === 'completed') continue;
      const status = parent.status === 'waiting' ? (task.runId ? 'waiting' : 'queued') : 'failed';
      context.board.record(
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
      await context.detect();
      await context.runtimeMaintenance.recover();
      await seedRecommendedRoles(context);
      await context.runtimeMaintenance.initializeAuthentication();
    })();
    // Public starter sources and CLI metadata can load together. Both must finish before the
    // daemon becomes ready; skill commits wait for role setup and recheck current assignments.
    await Promise.all([rolesReady, ...(seedSkills ? [context.seedStarterSkills(rolesReady)] : [])]);
    for (const role of context.board.list<Role>('role')) await context.writeRole(role);
    migrateConversations(context);
    for (const task of interruptedTasks) {
      const queue = ensureQueue(context, task.threadId, task.rootRunId);
      if (!queue.id.startsWith('routine:'))
        patchQueue(context, queue.id, {
          paused: true,
          pauseKind: 'interrupted',
          reason: 'Interrupted by daemon restart. Retry or skip this follow-up.',
        });
    }
    for (const request of context.board.list<import('@pitchcrew/core').ChatRequest>(
      'chat_request',
    )) {
      if (!request.deliveries.some((delivery) => ['queued', 'running'].includes(delivery.status)))
        continue;
      for (const delivery of request.deliveries)
        if (delivery.status === 'running')
          delivery.status =
            delivery.runId && context.board.get<Run>('run', delivery.runId).status === 'waiting'
              ? 'waiting'
              : 'paused';
      context.board.record('chat_request', request, 'system', 'Recovered saved user request');
      const queue = ensureQueue(context, request.threadId, request.rootRunId);
      if (request.deliveries.some((d) => d.status === 'paused' && d.runId))
        patchQueue(context, queue.id, {
          paused: true,
          pauseKind: 'interrupted',
          reason: 'Interrupted by daemon restart. Retry or skip this request.',
        });
    }
  } finally {
    context.initializing = false;
  }
};
export const snapshot = async (
  context: CrewContext,
  options?: { workspace?: boolean },
): Promise<Snapshot> => {
  // Finish filesystem reads before collecting board state, so no run can advance between entities.
  const profile = await readProfile(context.directory);
  migrateConversations(context);
  const snapshot: Snapshot = {
    quality: qualitySnapshot(context, profile),
    queue: workspaceQueue(context),
    userInputs: context.board.list('user_input'),
    conversations: conversations(context),
    chatRequests: context.board.list('chat_request'),
    memories: context.board
      .list<import('@pitchcrew/core').AgentMemory>('agent_memory')
      .filter((memory) => !memory.deleted),
    onboarding: context.onboarding.get(),
    packetRules: context.packetRules.current(),
    instructionUpdates: instructionUpdates(context),
    skillUpdates: context.skillUpdateChecks.current(context),
    trackingSignals: context.board.list<TrackingSignal>('tracking_signal'),
    trackingScans: context.board.list<TrackingScan>('tracking_scan'),
    cards: options?.workspace ? workspaceCards(context.board) : context.board.list<Card>('card'),
    roles: context.board.list<Role>('role'),
    skills: context.skills(),
    starterSkillErrors: context.starterSkillErrors,
    skillProposals: context.board.list<SkillProposal>('skill_proposal'),
    runs: options?.workspace
      ? workspaceRuns(context.board)
      : context.board.list<Run>('run').reverse(),
    approvals: context.board.list<Approval>('approval').reverse(),
    computerApprovals: context.board.list<ComputerApproval>('computer_approval').reverse(),
    events: options?.workspace ? workspaceEvents(context.board) : context.board.events(),
    profileProposals: context.board.list('profile_proposal'),
    profile,
    profileOrganization: context.profileOrganization.get(),
    runtimes: context.runtimes,
    runtimeMaintenance: context.runtimeMaintenance.current(),
    dataDirectory: context.directory,
    demoAvailable: context.dev && !context.board.list<Card>('card').some((c) => c.sample),
    ...(options?.workspace
      ? { workspace: true as const, ...workspaceMessages(context.board) }
      : { messages: context.board.list<ChatMessage>('message') }),
    streamingMessages: [...context.streamingMessages.values()],
    activityRuns: activityRuns(context),
    proposals: context.board.list<RoleProposal>('proposal'),
    pipelineReviews: context.board.list<PipelineReview>('pipeline_review').reverse(),
    tasks: context.board.list<AgentTask>('task'),
    routines: routines(context),
    connectors: context.connectors.status(),
  };
  // Derived from the approvals collected above, after all board reads.
  const artifacts = snapshot.approvals.flatMap((approval) => approval.artifacts ?? []);
  return { ...snapshot, artifactPages: await artifactPages(artifacts) };
};
export const close = async (context: CrewContext): Promise<void> => {
  context.closing = true;
  clearInterval(context.schedulerTimer);
  context.modelController.abort();
  context.jobSources.close();
  for (const run of context.board
    .list<Run>('run')
    .filter((r) => r.status === 'running' && r.threadId)) {
    const queue = ensureQueue(context, run.threadId!, run.rootRunId);
    if (!queue.id.startsWith('routine:'))
      patchQueue(context, queue.id, {
        paused: true,
        pauseKind: 'interrupted',
        reason: 'Interrupted when the daemon stopped. Retry or skip this request.',
      });
  }
  for (const controller of context.controllers.values()) controller.abort();
  await Promise.allSettled([
    ...context.modelRequests.values(),
    context.skillUpdateChecks.close(),
    context.runtimeMaintenance.close(),
    ...(context.starterRequest ? [context.starterRequest] : []),
  ]);
  await context.connectors.close();
  await context.computer.close();
  for (
    let i = 0;
    i < 100 && (context.controllers.size || context.draining || context.scheduling);
    i++
  )
    await new Promise((resolve) => setTimeout(resolve, 25));
  if (context.controllers.size || context.draining || context.scheduling)
    throw new Error('Some runs did not stop in time.');
  context.board.close();
};
