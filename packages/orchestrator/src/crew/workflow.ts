import { QueueBusyError, reserveLaunch } from './queue/admission.ts';
import { ensureQueue, patchQueue, runLane } from './queue/state.ts';
import { recordOperationalLog } from '../telemetry/logs.ts';
import {
  endQuestionTurn,
  finishUserContinuation,
  waitingOnUser,
  cancelUserQuestions,
} from './user-input/lifecycle.ts';
import { finishDelivery } from './conversation-queue.ts';
import { relatedConversation } from './conversations.ts';
import { drainConversationQueue } from './conversation-queue.ts';
import { requireRole } from './roles.ts';
import { assertProfileReady } from '../profile-sources/mutation.ts';
import { runConfiguration, packetDigest } from './pipeline/snapshots.ts';
import { adapters } from '@pitchcrew/adapters';
import { beginAiRun } from '../telemetry/ai.ts';
import {
  runResultSchema,
  workflowSeat,
  type AgentTask,
  type Card,
  type Conversation,
  type ChatRequest,
  type ProfileFile,
  type Role,
  type RoleId,
  type Run,
  type RunResult,
} from '@pitchcrew/core';
import { readProfile, warningFeedback, writePacket } from '@pitchcrew/packet';
import { randomUUID, createHash } from 'node:crypto';
import { join } from 'node:path';
import type { CrewContext } from './types.ts';
import { assertConfirmedContext, assertExtractedContext, digestPacket } from '@pitchcrew/board';
import { draftingCard, missingPersonalAnswers } from '@pitchcrew/core';
import { assertApplicationRuntime } from './application-context/extraction.ts';
import { applicationUserAnswers } from './application-context/answers.ts';
import { changeSummary } from './change-summary.ts';

async function startRunPrepared(
  this: CrewContext,
  cardId: string,
  roleId: RoleId,
  task?: AgentTask,
  delivery?: { requestId: string; rootRunId: string; content: string },
  applicationDraft = false,
): Promise<Run> {
  if (this.closing) throw new Error('The daemon is stopping.');
  assertProfileReady(this);
  if (this.profileWriting) throw new Error('Wait for the profile update to finish.');
  const profileRevision = this.profileRevision;
  if (this.configuring.has(roleId)) throw new Error('Wait for this role’s settings update.');
  const storedRole = requireRole(this, roleId);
  let role = applicationDraft ? { ...storedRole, workflow: 'writer' as const } : storedRole;
  const skills = this.skills(roleId);
  const card = this.board.get<Card>('card', cardId);
  if (!role.enabled) throw new Error('Enable this role in Crew first.');
  if (!this.runtimes.find((r) => r.id === role.runtime)?.available)
    throw new Error('This runtime is not installed. Check Crew settings.');
  if (this.board.hasActiveRun(cardId))
    throw new Error('This application already has an active run.');
  const seat = workflowSeat(role);
  if (seat === 'chat') throw new Error('This role has no application workflow seat. Use chat.');
  assertApplicationRuntime(role);
  const applicationContext =
    seat === 'scout' ? assertExtractedContext(card) : assertConfirmedContext(card);
  const userAnswers = applicationUserAnswers(
    this,
    cardId,
    roleId,
    seat === 'scout' ? 'fit' : seat === 'writer' ? 'application-draft' : 'application-review',
  );
  const allowed = {
    scout: ['lead'],
    writer: ['shortlisted', 'changes_requested'],
    reviewer: ['in_review', 'agreed', 'awaiting_approval'],
  };
  if (!allowed[seat].includes(card.state))
    throw new Error(`The ${roleId} cannot run on a card in ${card.state}.`);
  const sourceThread =
    task?.threadId ??
    (delivery
      ? this.board
          .list<ChatRequest>('chat_request')
          .find((request) => request.id === delivery.requestId)?.threadId
      : undefined);
  const browserConversation = this.board
    .list<Conversation>('conversation')
    .find((conversation) =>
      sourceThread
        ? conversation.id === sourceThread
        : conversation.kind === 'application' && conversation.cardId === cardId,
    );
  const browserMode = browserConversation?.configurations[roleId]?.browserMode;
  if (browserMode !== undefined) role = { ...role, browserMode };
  const profile = await readProfile(this.directory);
  if (!profile.length) throw new Error('Add your profile notes before starting the crew.');
  const run: Run = {
    id: randomUUID(),
    profileDigest: createHash('sha256').update(JSON.stringify(profile)).digest('hex'),
    cardId,
    roleId,
    runtime: role.runtime,
    configuration: runConfiguration(role, skills),
    inputPacketDigest: packetDigest(card),
    status: 'running',
    message: 'Starting role…',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    mode: 'workflow',
    purpose:
      seat === 'writer' ? 'application-draft' : seat === 'reviewer' ? 'application-review' : 'fit',
    contextRevision: applicationContext.revision,
    threadId:
      task?.threadId ??
      relatedConversation(
        this,
        'application',
        cardId,
        roleId,
        cardId,
        `${card.company}: Application work`,
      ).id,
    ...(task ? { rootRunId: task.rootRunId, taskId: task.id } : {}),
  };
  if (waitingOnUser(this, run.threadId!, roleId))
    throw new Error('Answer or cancel this agent’s pending question first.');
  if (delivery) {
    run.requestId = delivery.requestId;
    run.rootRunId = delivery.rootRunId;
  }
  const dir = join(this.directory, 'roles', roleId, 'runs', run.id);
  await this.writeRunInstructions(dir, role, skills);
  if (ensureQueue(this, run.threadId!, run.rootRunId).paused)
    throw new QueueBusyError('This queue was paused while the action was starting.');
  if (
    this.closing ||
    this.profileWriting ||
    this.profileRevision !== profileRevision ||
    (task &&
      (this.board.get<AgentTask>('task', task.id).status !== 'queued' ||
        !this.taskPermissionsAllow(task))) ||
    this.board.hasActiveRun(cardId) ||
    this.board.get<Card>('card', cardId).state !== card.state ||
    this.board.get<Card>('card', cardId).applicationContext?.revision !==
      applicationContext.revision ||
    this.configuring.has(roleId) ||
    JSON.stringify(requireRole(this, roleId)) !== JSON.stringify(storedRole)
  )
    throw new Error('This application changed or was claimed by another run. Refresh and retry.');
  const controller = new AbortController();
  this.controllers.set(run.id, controller);
  const token = randomUUID();
  this.capabilities.set(token, { runId: run.id, cardId, roleId });
  if (seat === 'writer') this.board.move(cardId, 'drafting', 'orchestrator');
  if (seat === 'reviewer' && card.state !== 'in_review')
    this.board.record(
      'card',
      { ...card, state: 'in_review', packetReview: undefined, updatedAt: new Date().toISOString() },
      'orchestrator',
      'Started fresh review of the existing packet',
    );
  this.board.updateCard(
    cardId,
    { owner: roleId },
    'orchestrator',
    `${role.name} claimed this application`,
  );
  this.board.record('run', run, 'orchestrator', `Started ${role.name} on ${role.runtime}`);
  const context = {
    card: draftingCard(this.board.get<Card>('card', cardId), run.purpose),
    purpose: run.purpose,
    userAnswers,
    role,
    skills,
    profile,
    packetRules: this.packetRules.current().rules,
    directory: dir,
    mcp: {
      command: process.execPath,
      args: ['--import', import.meta.resolve('tsx'), this.mcpEntry],
      env: { PITCHCREW_RUN_TOKEN: token, PITCHCREW_DAEMON_URL: this.daemonUrl },
    },
    signal: controller.signal,
    onMessage: (message: string) => {
      const current = this.board.get<Run>('run', run.id);
      if (current.status === 'running')
        this.board.record('run', { ...current, message }, roleId, message);
    },
  };
  const ai = beginAiRun(this.diagnostics, 'workflow');
  void ai
    .observe(() => adapters[role.runtime].run(context), controller.signal)
    .then(async (result) => {
      if (endQuestionTurn(this, run)) return;
      if (controller.signal.aborted) throw new Error('Run cancelled.');
      await this.applyResult(cardId, role, result, profile, controller.signal, {
        contextRevision: applicationContext.revision,
        runId: run.id,
      });
      this.board.record(
        'run',
        {
          ...run,
          status: 'completed',
          outputPacketDigest: packetDigest(this.board.get<Card>('card', cardId)),
          message: `${role.name} finished`,
          finishedAt: new Date().toISOString(),
        },
        roleId,
        `${role.name} completed its work`,
      );
    })
    .catch((error) => {
      if (endQuestionTurn(this, run)) return;
      recordOperationalLog(this.diagnostics, {
        code: controller.signal.aborted ? 'runtime_run_cancelled' : 'runtime_run_failed',
        area: 'workflow',
      });
      const message = error instanceof Error ? error.message : 'Run failed.';
      this.board.record(
        'run',
        {
          ...run,
          status: controller.signal.aborted ? 'cancelled' : 'failed',
          message,
          finishedAt: new Date().toISOString(),
        },
        roleId,
        message,
      );
      const current = this.board.get<Card>('card', cardId);
      if (current.state === 'drafting')
        this.board.move(cardId, 'changes_requested', roleId, 'Draft failed; retry the writer');
    })
    .finally(async () => {
      const outcome = this.board.get<Run>('run', run.id).status;
      ai.finish(outcome === 'running' ? 'failed' : outcome);
      await this.computer.stop(run.id);
      this.board.updateCard(cardId, { owner: null }, 'orchestrator', 'Released application');
      if (
        this.board.get<Run>('run', run.id).status === 'waiting' &&
        this.board.get<Card>('card', cardId).state === 'drafting'
      )
        this.board.move(cardId, 'changes_requested', roleId, 'Writer is waiting for your answer');
      this.controllers.delete(run.id);
      this.capabilities.delete(token);
      finishUserContinuation(this, run);
      this.finishTask(run);
      finishDelivery(this, run);
      void drainConversationQueue(this);
      void this.drainTasks();
    });
  return run;
}
export async function applyResult(
  this: CrewContext,
  cardId: string,
  role: Role,
  data: unknown,
  profile: ProfileFile[] = [],
  signal?: AbortSignal,
  evidence?: { contextRevision: string; runId: string },
): Promise<void> {
  const result: RunResult = runResultSchema.parse(data);
  if (result.role !== workflowSeat(role)) throw new Error('Result role does not match the run.');
  const context =
    result.role === 'scout'
      ? assertExtractedContext(this.board.get<Card>('card', cardId))
      : assertConfirmedContext(this.board.get<Card>('card', cardId));
  const assertCurrent = () => {
    if (signal?.aborted) throw new Error('Run cancelled.');
    const current =
      result.role === 'scout'
        ? assertExtractedContext(this.board.get<Card>('card', cardId))
        : assertConfirmedContext(this.board.get<Card>('card', cardId));
    if (
      current.revision !== context.revision ||
      (evidence && evidence.contextRevision !== current.revision)
    )
      throw new Error('Application context changed during this run. Confirm and run again.');
  };
  assertCurrent();
  const summary = changeSummary(result, this.board.get<Card>('card', cardId).packet);
  if (result.role === 'scout') {
    this.board.updateCard(
      cardId,
      { fit: result.fit, feedback: result.reasons },
      role.id,
      `Evaluated job fit: ${summary}`,
    );
  }
  if (result.role === 'writer') {
    const check = await this.packetRules.check(result.packet, profile);
    assertCurrent();
    if (check.errors.length) throw new Error(check.errors.join('\n'));
    await writePacket(this.directory, cardId, result.packet);
    assertCurrent();
    this.board.updateCard(
      cardId,
      {
        packet: result.packet,
        packetContextRevision: context.revision,
        packetReview: undefined,
        feedback: warningFeedback(check.warnings),
      },
      role.id,
      `Drafted application packet: ${summary}`,
    );
    this.board.move(cardId, 'in_review', role.id);
  }
  if (result.role === 'reviewer') {
    const card = this.board.get<Card>('card', cardId);
    if (!card.packet) throw new Error('No packet to review.');
    const check = await this.packetRules.check(card.packet, profile);
    assertCurrent();
    if (
      !this.board.get<Card>('card', cardId).packet ||
      digestPacket(cardId, this.board.get<Card>('card', cardId).packet!) !==
        digestPacket(cardId, card.packet)
    )
      throw new Error('Packet changed during review.');
    const missing = missingPersonalAnswers(context).map(
      (r) => `Answer required personal question: ${r.question}`,
    );
    // Reviewer feedback still fails the review; rule warnings are shown without blocking.
    const passed =
      result.passed &&
      check.errors.length === 0 &&
      result.feedback.length === 0 &&
      missing.length === 0;
    const feedback = [
      ...new Set([
        ...check.errors,
        ...missing,
        ...result.feedback,
        ...warningFeedback(result.suggestions ?? []),
        ...warningFeedback(check.warnings),
      ]),
    ];
    const reviewSummary = changeSummary(
      {
        ...result,
        feedback,
        // Describe server-enforced blockers when they override the agent's verdict.
        changeSummary: passed === result.passed ? result.changeSummary : undefined,
      },
      card.packet,
    );
    this.board.updateCard(
      cardId,
      {
        feedback,
        packetContextRevision: context.revision,
        packetReview: passed
          ? {
              contextRevision: context.revision,
              packetDigest: digestPacket(cardId, card.packet),
              runId: evidence?.runId ?? 'local-review',
              reviewedAt: new Date().toISOString(),
            }
          : undefined,
      },
      role.id,
      `${passed ? 'Reviewer approved the packet' : 'Reviewer requested changes'}: ${reviewSummary}`,
    );
    this.board.move(cardId, passed ? 'agreed' : 'changes_requested', role.id);
  }
}
export function cancelRun(this: CrewContext, id: string): void {
  const reviewRun = this.board.get<Run>('run', id);
  const parentId = reviewRun.deepReviewId
    ? (this.deepReviewExecutions.get(reviewRun.deepReviewId)?.runId ?? id)
    : id;
  const queue = this.board
    .list<import('@pitchcrew/core').WorkQueue>('work_queue')
    .find((q) => q.id === runLane(this, reviewRun));
  if (queue && !queue.id.startsWith('routine:'))
    patchQueue(this, queue.id, { paused: true, pauseKind: 'user', reason: 'Paused by you.' });
  const controller = this.controllers.get(parentId);
  if (!controller) throw new Error('This run is no longer active.');
  controller.abort();
  const run = this.board.get<Run>('run', id);
  const rootRunId = run.rootRunId ?? run.id;
  cancelUserQuestions(
    this,
    (q) => {
      const origin = this.board.get<Run>('run', q.runId);
      return (origin.rootRunId ?? origin.id) === rootRunId;
    },
    'The run chain was stopped by the user.',
  );
  for (const sibling of this.board
    .list<Run>('run')
    .filter((r) => (r.rootRunId ?? r.id) === rootRunId)) {
    this.controllers.get(sibling.id)?.abort();
    this.streamingMessages.delete(sibling.id);
  }
  this.publishChat();
  for (const task of this.board
    .list<AgentTask>('task')
    .filter((t) => t.rootRunId === rootRunId && t.status === 'queued'))
    this.board.record(
      'task',
      { ...task, status: 'cancelled', error: 'The run chain was stopped by the user.' },
      'user',
      'Cancelled queued crew task',
    );
}

export async function startRun(
  this: CrewContext,
  ...args: Parameters<CrewContext['startRun']>
): Promise<Run> {
  if (!args[2] && !args[3])
    await this.runtimeMaintenance.refreshOnRetry(requireRole(this, args[1]));
  const [cardId, roleId, task, delivery] = args;
  const threadId =
    task?.threadId ??
    (delivery
      ? this.board.get<ChatRequest>('chat_request', delivery.requestId).threadId
      : relatedConversation(this, 'application', cardId, roleId, cardId, 'Application work').id);
  const queue = ensureQueue(this, threadId);
  if (!task && !delivery)
    patchQueue(this, queue.id, { paused: false, pauseKind: undefined, reason: '' });
  return reserveLaunch(
    this,
    { cardId, roleId, threadId, isolated: true, rootRunId: task?.rootRunId ?? delivery?.rootRunId },
    () =>
      this.runtimeMaintenance.guard(
        requireRole(this, args[1]),
        () => startRunPrepared.call(this, ...args),
        false,
        () => requireRole(this, args[1]),
      ),
  );
}
