import { recordChatActivity, finishChatActivity } from './chat-activity.ts';
import { QueueBusyError, reserveLaunch } from './queue/admission.ts';
import { ensureQueue, patchQueue, runLane } from './queue/state.ts';
import { recordOperationalLog } from '../telemetry/logs.ts';
import { documentReviewCycle } from '../quality/repair.ts';
import { guideForRun, finishWritingCorrection } from '../quality/writing.ts';
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
  type RuntimeActivity,
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

const startRunPrepared = async (
  crewContext: CrewContext,
  cardId: string,
  roleId: RoleId,
  task?: AgentTask,
  delivery?: { requestId: string; rootRunId: string; content: string },
  applicationDraft = false,
): Promise<Run> => {
  if (crewContext.closing) throw new Error('The daemon is stopping.');
  assertProfileReady(crewContext);
  if (crewContext.profileWriting) throw new Error('Wait for the profile update to finish.');
  const profileRevision = crewContext.profileRevision;
  if (crewContext.configuring.has(roleId)) throw new Error('Wait for this role’s settings update.');
  const storedRole = requireRole(crewContext, roleId);
  let role = applicationDraft ? { ...storedRole, workflow: 'writer' as const } : storedRole;
  const skills = crewContext.skills(roleId);
  const card = crewContext.board.get<Card>('card', cardId);
  const correction = task?.writingCorrectionId
    ? crewContext.board.get<import('@pitchcrew/core').WritingCorrection>(
        'writing_correction',
        task.writingCorrectionId,
      )
    : undefined;
  if (
    correction &&
    (!card.packet ||
      correction.cardId !== card.id ||
      digestPacket(card.id, card.packet) !== correction.packetDigest ||
      correction.after)
  )
    throw new Error('The correction draft changed. Request a fresh correction.');
  if (!role.enabled) throw new Error('Enable this role in Crew first.');
  if (!crewContext.runtimes.find((r) => r.id === role.runtime)?.available)
    throw new Error('This runtime is not installed. Check Crew settings.');
  if (crewContext.board.hasActiveRun(cardId))
    throw new Error('This application already has an active run.');
  const seat = workflowSeat(role);
  if (seat === 'chat') throw new Error('This role has no application workflow seat. Use chat.');
  assertApplicationRuntime(role);
  const applicationContext =
    seat === 'scout' ? assertExtractedContext(card) : assertConfirmedContext(card);
  const userAnswers = applicationUserAnswers(
    crewContext,
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
      ? crewContext.board
          .list<ChatRequest>('chat_request')
          .find((request) => request.id === delivery.requestId)?.threadId
      : undefined);
  const browserConversation = crewContext.board
    .list<Conversation>('conversation')
    .find((conversation) =>
      sourceThread
        ? conversation.id === sourceThread
        : conversation.kind === 'application' && conversation.cardId === cardId,
    );
  const browserMode = browserConversation?.configurations[roleId]?.browserMode;
  if (browserMode !== undefined) role = { ...role, browserMode };
  const profile = await readProfile(crewContext.directory);
  if (!profile.length) throw new Error('Add your profile notes before starting the crew.');
  const run: Run = {
    writingGuide: seat === 'scout' ? undefined : guideForRun(crewContext),
    writingCorrectionId: correction?.id,
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
        crewContext,
        'application',
        cardId,
        roleId,
        cardId,
        `${card.company}: Application work`,
      ).id,
    ...(task ? { rootRunId: task.rootRunId, taskId: task.id } : {}),
  };
  if (waitingOnUser(crewContext, run.threadId!, roleId))
    throw new Error('Answer or cancel this agent’s pending question first.');
  if (delivery) {
    run.requestId = delivery.requestId;
    run.rootRunId = delivery.rootRunId;
  }
  const dir = join(crewContext.directory, 'roles', roleId, 'runs', run.id);
  await crewContext.writeRunInstructions(dir, role, skills);
  if (ensureQueue(crewContext, run.threadId!, run.rootRunId).paused)
    throw new QueueBusyError('This queue was paused while the action was starting.');
  if (
    crewContext.closing ||
    crewContext.profileWriting ||
    crewContext.profileRevision !== profileRevision ||
    (task &&
      (crewContext.board.get<AgentTask>('task', task.id).status !== 'queued' ||
        !crewContext.taskPermissionsAllow(task))) ||
    crewContext.board.hasActiveRun(cardId) ||
    crewContext.board.get<Card>('card', cardId).state !== card.state ||
    crewContext.board.get<Card>('card', cardId).applicationContext?.revision !==
      applicationContext.revision ||
    crewContext.configuring.has(roleId) ||
    JSON.stringify(requireRole(crewContext, roleId)) !== JSON.stringify(storedRole)
  )
    throw new Error('This application changed or was claimed by another run. Refresh and retry.');
  const controller = new AbortController();
  crewContext.controllers.set(run.id, controller);
  const token = randomUUID();
  crewContext.capabilities.set(token, { runId: run.id, cardId, roleId });
  if (seat === 'writer') crewContext.board.move(cardId, 'drafting', 'orchestrator');
  if (seat === 'reviewer' && card.state !== 'in_review')
    crewContext.board.record(
      'card',
      { ...card, state: 'in_review', packetReview: undefined, updatedAt: new Date().toISOString() },
      'orchestrator',
      'Started fresh review of the existing packet',
    );
  crewContext.board.updateCard(
    cardId,
    { owner: roleId },
    'orchestrator',
    `${role.name} claimed this application`,
  );
  crewContext.board.record('run', run, 'orchestrator', `Started ${role.name} on ${role.runtime}`);
  const context = {
    writingGuide: run.writingGuide,
    request: correction?.instruction,
    deadline: { expiresAt: Date.now() + 30 * 60_000 },
    card: draftingCard(crewContext.board.get<Card>('card', cardId), run.purpose),
    purpose: run.purpose,
    userAnswers,
    role,
    skills,
    profile,
    packetRules: crewContext.packetRules.current().rules,
    directory: dir,
    mcp: {
      command: process.execPath,
      args: ['--import', import.meta.resolve('tsx'), crewContext.mcpEntry],
      env: { PITCHCREW_RUN_TOKEN: token, PITCHCREW_DAEMON_URL: crewContext.daemonUrl },
    },
    signal: controller.signal,
    onActivity: (activity: RuntimeActivity) => recordChatActivity(crewContext, run.id, activity),
    onMessage: (message: string) => {
      const current = crewContext.board.get<Run>('run', run.id);
      if (current.status === 'running') {
        crewContext.board.record('run', { ...current, message }, roleId, message);
        recordChatActivity(crewContext, run.id, {
          id: 'workflow-progress',
          kind: 'commentary',
          label: 'Progress update',
          text: message,
          status: 'completed',
        });
      }
    },
  };
  const ai = beginAiRun(crewContext.diagnostics, 'workflow');
  void ai
    .observe(() => adapters[role.runtime].run(context), controller.signal)
    .then(async (result) => {
      if (endQuestionTurn(crewContext, run)) return;
      if (controller.signal.aborted) throw new Error('Run cancelled.');
      await crewContext.applyResult(cardId, role, result, profile, controller.signal, {
        contextRevision: applicationContext.revision,
        runId: run.id,
      });
      if (correction && result.role === 'writer')
        finishWritingCorrection(
          crewContext,
          correction.id,
          crewContext.board.get<Card>('card', cardId).packet!,
        );
      if (seat !== 'scout') await documentReviewCycle(crewContext, run, profile, controller.signal);
      crewContext.board.record(
        'run',
        {
          ...run,
          status: 'completed',
          outputPacketDigest: packetDigest(crewContext.board.get<Card>('card', cardId)),
          message: `${role.name} finished`,
          finishedAt: new Date().toISOString(),
        },
        roleId,
        `${role.name} completed its work`,
      );
    })
    .catch((error) => {
      if (endQuestionTurn(crewContext, run)) return;
      recordOperationalLog(crewContext.diagnostics, {
        code: controller.signal.aborted ? 'runtime_run_cancelled' : 'runtime_run_failed',
        area: 'workflow',
      });
      const message = error instanceof Error ? error.message : 'Run failed.';
      crewContext.board.record(
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
      const current = crewContext.board.get<Card>('card', cardId);
      if (current.state === 'drafting')
        crewContext.board.move(
          cardId,
          'changes_requested',
          roleId,
          'Draft failed; retry the writer',
        );
    })
    .finally(async () => {
      const outcome = crewContext.board.get<Run>('run', run.id).status;
      ai.finish(outcome === 'running' ? 'failed' : outcome);
      await crewContext.computer.stop(run.id);
      crewContext.board.updateCard(cardId, { owner: null }, 'orchestrator', 'Released application');
      if (
        crewContext.board.get<Run>('run', run.id).status === 'waiting' &&
        crewContext.board.get<Card>('card', cardId).state === 'drafting'
      )
        crewContext.board.move(
          cardId,
          'changes_requested',
          roleId,
          'Writer is waiting for your answer',
        );
      finishChatActivity(crewContext, run.id);
      crewContext.controllers.delete(run.id);
      crewContext.capabilities.delete(token);
      finishUserContinuation(crewContext, run);
      crewContext.finishTask(run);
      finishDelivery(crewContext, run);
      void drainConversationQueue(crewContext);
      void crewContext.drainTasks();
    });
  return run;
};
export const applyResult = async (
  crewContext: CrewContext,
  cardId: string,
  role: Role,
  data: unknown,
  profile: ProfileFile[] = [],
  signal?: AbortSignal,
  evidence?: { contextRevision: string; runId: string },
): Promise<void> => {
  const result: RunResult = runResultSchema.parse(data);
  if (result.role !== workflowSeat(role)) throw new Error('Result role does not match the run.');
  const context =
    result.role === 'scout'
      ? assertExtractedContext(crewContext.board.get<Card>('card', cardId))
      : assertConfirmedContext(crewContext.board.get<Card>('card', cardId));
  const assertCurrent = () => {
    if (signal?.aborted) throw new Error('Run cancelled.');
    const current =
      result.role === 'scout'
        ? assertExtractedContext(crewContext.board.get<Card>('card', cardId))
        : assertConfirmedContext(crewContext.board.get<Card>('card', cardId));
    if (
      current.revision !== context.revision ||
      (evidence && evidence.contextRevision !== current.revision)
    )
      throw new Error('Application context changed during this run. Confirm and run again.');
  };
  assertCurrent();
  const summary = changeSummary(result, crewContext.board.get<Card>('card', cardId).packet);
  if (result.role === 'scout') {
    crewContext.board.updateCard(
      cardId,
      { fit: result.fit, feedback: result.reasons },
      role.id,
      `Evaluated job fit: ${summary}`,
    );
  }
  if (result.role === 'writer') {
    const check = await crewContext.packetRules.check(result.packet, profile);
    assertCurrent();
    if (check.errors.length) throw new Error(check.errors.join('\n'));
    await writePacket(crewContext.directory, cardId, result.packet);
    assertCurrent();
    crewContext.board.updateCard(
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
    crewContext.board.move(cardId, 'in_review', role.id);
  }
  if (result.role === 'reviewer') {
    const card = crewContext.board.get<Card>('card', cardId);
    if (!card.packet) throw new Error('No packet to review.');
    const check = await crewContext.packetRules.check(card.packet, profile);
    assertCurrent();
    if (
      !crewContext.board.get<Card>('card', cardId).packet ||
      digestPacket(cardId, crewContext.board.get<Card>('card', cardId).packet!) !==
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
    crewContext.board.updateCard(
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
    crewContext.board.move(cardId, passed ? 'agreed' : 'changes_requested', role.id);
  }
};
export const cancelRun = (context: CrewContext, id: string): void => {
  const reviewRun = context.board.get<Run>('run', id);
  const parentId = reviewRun.deepReviewId
    ? (context.deepReviewExecutions.get(reviewRun.deepReviewId)?.runId ?? id)
    : id;
  const queue = context.board
    .list<import('@pitchcrew/core').WorkQueue>('work_queue')
    .find((q) => q.id === runLane(context, reviewRun));
  if (queue && !queue.id.startsWith('routine:'))
    patchQueue(context, queue.id, { paused: true, pauseKind: 'user', reason: 'Paused by you.' });
  const controller = context.controllers.get(parentId);
  if (!controller) throw new Error('This run is no longer active.');
  controller.abort();
  const run = context.board.get<Run>('run', id);
  const rootRunId = run.rootRunId ?? run.id;
  cancelUserQuestions(
    context,
    (q) => {
      const origin = context.board.get<Run>('run', q.runId);
      return (origin.rootRunId ?? origin.id) === rootRunId;
    },
    'The run chain was stopped by the user.',
  );
  for (const sibling of context.board
    .list<Run>('run')
    .filter((r) => (r.rootRunId ?? r.id) === rootRunId)) {
    context.controllers.get(sibling.id)?.abort();
    context.streamingMessages.delete(sibling.id);
  }
  context.publishChat();
  for (const task of context.board
    .list<AgentTask>('task')
    .filter((t) => t.rootRunId === rootRunId && t.status === 'queued'))
    context.board.record(
      'task',
      { ...task, status: 'cancelled', error: 'The run chain was stopped by the user.' },
      'user',
      'Cancelled queued crew task',
    );
};

export const startRun = async (
  context: CrewContext,
  ...args: Parameters<CrewContext['startRun']>
): Promise<Run> => {
  if (!args[2] && !args[3])
    await context.runtimeMaintenance.refreshOnRetry(requireRole(context, args[1]));
  const [cardId, roleId, task, delivery] = args;
  const threadId =
    task?.threadId ??
    (delivery
      ? context.board.get<ChatRequest>('chat_request', delivery.requestId).threadId
      : relatedConversation(
          context,
          'application',
          cardId,
          roleId,
          cardId,
          `${context.board.get<Card>('card', cardId).company}: Application work`,
        ).id);
  const queue = ensureQueue(context, threadId);
  if (!task && !delivery)
    patchQueue(context, queue.id, { paused: false, pauseKind: undefined, reason: '' });
  return reserveLaunch(
    context,
    { cardId, roleId, threadId, isolated: true, rootRunId: task?.rootRunId ?? delivery?.rootRunId },
    () =>
      context.runtimeMaintenance.guard(
        requireRole(context, args[1]),
        () => startRunPrepared(context, ...args),
        false,
        () => requireRole(context, args[1]),
      ),
  );
};
