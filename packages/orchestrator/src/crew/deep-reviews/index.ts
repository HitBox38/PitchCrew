import { randomUUID } from 'node:crypto';
import { RuntimeHeldError } from '../../runtime-maintenance/availability.ts';
import { assertConfirmedContext, digestPacket } from '@pitchcrew/board';
import {
  deepReviewOptionsSchema,
  workflowSeat,
  type Card,
  type DeepReview,
  type Role,
  type Run,
  type UserInputRequest,
  type ChatRequest,
} from '@pitchcrew/core';
import { readProfile } from '@pitchcrew/packet';
import { assertProfileReady } from '../../profile-sources/mutation.ts';
import { assertApplicationRuntime } from '../application-context/extraction.ts';
import { relatedConversation, canReadConversation } from '../conversations.ts';
import { requireRole } from '../roles.ts';
import { runConfiguration, packetDigest } from '../pipeline/snapshots.ts';
import type { CrewContext } from '../types.ts';
import { executeDeepReview } from './lifecycle.ts';
import { profileDigest, review, updateReview } from './state.ts';
import type { LiveDeepReview } from './types.ts';

function workflowRole(context: CrewContext, seat: 'reviewer' | 'writer', id?: string): Role {
  const role = id
    ? requireRole(context, id)
    : context.board
        .list<Role>('role')
        .find((r) => !r.retiredAt && r.enabled && workflowSeat(r) === seat);
  if (!role || !role.enabled || role.retiredAt || workflowSeat(role) !== seat)
    throw new Error(`Configure and enable a ${seat} in Crew first.`);
  assertApplicationRuntime(role);
  if (!context.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available))
    throw new Error(`The ${seat} runtime is unavailable. Check Crew settings.`);
  return { ...role, workflow: seat };
}
async function startDeepReviewPrepared(
  context: CrewContext,
  cardId: string,
  input: unknown = {},
  resumeId?: string,
  delivery?: { requestId: string; rootRunId: string },
  sourceThreadId?: string,
  sourceRunId?: string,
) {
  if (sourceRunId) {
    const existing = context.board
      .list<DeepReview>('deep_review')
      .find((item) => item.sourceRunId === sourceRunId);
    if (existing) return context.board.get<Run>('run', existing.runId);
  }
  assertProfileReady(context);
  if (context.closing || context.profileWriting)
    throw new Error('Wait for workspace updates to finish.');
  const options = deepReviewOptionsSchema.parse(input);
  if (options.requestedPerspectives.length) options.secondOpinions = true;
  const reviewer = workflowRole(context, 'reviewer', options.reviewerId);
  const writer = workflowRole(context, 'writer', options.writerId);
  const card = context.board.get<Card>('card', cardId);
  if (
    !['shortlisted', 'changes_requested', 'in_review', 'agreed', 'awaiting_approval'].includes(
      card.state,
    )
  )
    throw new Error(
      'Shortlist this job before deep review; submitted and closed applications cannot be rewritten.',
    );
  const application = assertConfirmedContext(card);
  const original = resumeId ? review(context, resumeId) : undefined;
  if (original && (!['waiting', 'failed'].includes(original.status) || original.cardId !== card.id))
    throw new Error('This review is not waiting for continuation.');
  const continuing = original?.status === 'waiting';
  const continuation = delivery
    ? context.board.get<ChatRequest>('chat_request', delivery.requestId)
    : undefined;
  const answer = continuation?.userInputId
    ? context.board.get<UserInputRequest>('user_input', continuation.userInputId)
    : undefined;
  const answeredRequirement = !!(
    continuing &&
    answer?.status === 'answered' &&
    answer.applicationRequirementId &&
    answer.applicationContextRevision === original.contextRevision &&
    answer.continuationRequestId === continuation?.id &&
    context.board.get<Run>('run', answer.runId).deepReviewId === original.id
  );
  const changedContext = continuing && original.contextRevision !== application.revision;
  if (changedContext && !answeredRequirement)
    throw new Error('The job brief changed while waiting. Start a fresh deep review.');
  if (card.packet && card.packetContextRevision !== application.revision && !answeredRequirement)
    throw new Error('The packet belongs to an older job brief. Draft it again before deep review.');
  if (
    continuing &&
    original.currentPacketDigest !== undefined &&
    packetDigest(card) !== original.currentPacketDigest
  )
    throw new Error(
      'The resume changed while waiting. Start a fresh deep review for its new version.',
    );
  const profileRevision = context.profileRevision;
  const assertAvailable = () => {
    if (
      context.closing ||
      context.profileWriting ||
      context.profileRevision !== profileRevision ||
      context.board.hasActiveRun(cardId) ||
      context.board
        .list<Run>('run')
        .some(
          (r) =>
            r.status === 'running' &&
            ((r.mode !== 'chat' && r.cardId === cardId) ||
              ([reviewer.id, writer.id].includes(r.roleId) &&
                !(sourceThreadId && r.threadId === sourceThreadId && r.mode === 'chat'))),
        ) ||
      [reviewer.id, writer.id].some((id) => context.configuring.has(id))
    )
      throw new Error('Wait for active application, agent or settings work to finish.');
    for (const role of [reviewer, writer])
      if (
        JSON.stringify({ ...requireRole(context, role.id), workflow: role.workflow }) !==
        JSON.stringify(role)
      )
        throw new Error('Crew settings changed. Retry the deep review.');
    if (
      assertConfirmedContext(context.board.get<Card>('card', cardId)).revision !==
        application.revision ||
      packetDigest(context.board.get<Card>('card', cardId)) !== packetDigest(card)
    )
      throw new Error('Application changed. Retry the deep review.');
  };
  assertAvailable();
  const profile = await readProfile(context.directory);
  if (!profile.length) throw new Error('Add verified Profile notes before deep review.');
  assertAvailable();
  const threadId =
    options.threadId ??
    relatedConversation(
      context,
      'application',
      cardId,
      reviewer.id,
      cardId,
      `${card.company}: Deep resume review`,
    ).id;
  if (!canReadConversation(context, reviewer.id, threadId))
    throw new Error('Reviewer must participate in the selected conversation.');
  const conversation = context.board
    .list<import('@pitchcrew/core').Conversation>('conversation')
    .find((c) => c.id === threadId);
  if (conversation && conversation.cardId !== cardId)
    throw new Error('Attach this job to the conversation before starting deep review.');
  if (conversation && !conversation.participants.includes(writer.id))
    context.board.record(
      'conversation',
      {
        ...conversation,
        participants: [...conversation.participants, writer.id],
        updatedAt: new Date().toISOString(),
      },
      'user',
      'Included Writer in the requested deep review',
    );
  const id = resumeId ?? randomUUID();
  const now = new Date().toISOString();
  const run: Run = {
    id: randomUUID(),
    cardId,
    roleId: reviewer.id,
    runtime: reviewer.runtime,
    configuration: runConfiguration(reviewer, context.skills(reviewer.id)),
    deepReviewId: id,
    purpose: 'deep-review',
    contextRevision: application.revision,
    inputPacketDigest: packetDigest(card),
    status: 'running',
    message: 'Starting deep resume review',
    startedAt: now,
    finishedAt: null,
    mode: 'workflow',
    threadId: sourceThreadId ?? threadId,
    ...(delivery
      ? { requestId: delivery.requestId, rootRunId: delivery.rootRunId }
      : sourceRunId
        ? { rootRunId: context.board.get<Run>('run', sourceRunId).rootRunId ?? sourceRunId }
        : {}),
  };
  const controller = new AbortController();
  const deadline = { expiresAt: Date.now() + (original?.remainingMs ?? 30 * 60_000) };
  const live: LiveDeepReview = {
    id,
    runId: run.id,
    controller,
    deadline,
    profile,
    profileRevision,
    profileDigest: profileDigest(profile),
    contextRevision: application.revision,
    expectedPacketDigest: packetDigest(card),
    reviewer,
    writer,
    skills: new Map([reviewer, writer].map((role) => [role.id, context.skills(role.id)])),
    children: new Map(),
    stage:
      changedContext && answeredRequirement
        ? original.before
          ? 'correction'
          : 'draft'
        : continuing
          ? original.stage
          : card.packet
            ? 'review'
            : 'draft',
    packet: card.packet,
  };
  const report: DeepReview = {
    id,
    version: 1,
    runId: run.id,
    cardId,
    reviewerId: reviewer.id,
    writerId: writer.id,
    threadId,
    sourceThreadId: original?.sourceThreadId ?? sourceThreadId,
    sourceRunId: original?.sourceRunId ?? sourceRunId,
    status: 'running',
    stage: live.stage,
    contextRevision: application.revision,
    profileDigest: live.profileDigest,
    originalResume: continuing ? original.originalResume : card.packet?.resume,
    before: continuing ? original.before : undefined,
    beforeContextRevision: continuing ? original.beforeContextRevision : undefined,
    beforeProfileDigest:
      continuing && original.before
        ? (original.beforeProfileDigest ?? original.profileDigest)
        : undefined,
    inputPacketDigest: continuing
      ? original.inputPacketDigest
      : card.packet
        ? digestPacket(card.id, card.packet)
        : undefined,
    summary: 'Deep resume review is in progress.',
    options: { ...options, threadId },
    createdAt: original?.createdAt ?? now,
    updatedAt: now,
    finishedAt: null,
    deadlineAt: new Date(deadline.expiresAt).toISOString(),
    extensions: original?.extensions ?? [],
  };
  const writerReservation: Run = {
    ...run,
    id: randomUUID(),
    roleId: writer.id,
    runtime: writer.runtime,
    configuration: runConfiguration(writer, live.skills.get(writer.id) ?? []),
    rootRunId: run.rootRunId ?? run.id,
    threadId,
    requestId: undefined,
    reviewSeatReservation: true,
    message: 'Writer is reserved for this deep review',
  };
  context.board.db.transaction(() => {
    if (original) {
      const previous = context.board.get<Run>('run', original.runId);
      context.board.record(
        'run',
        {
          ...previous,
          status: 'completed',
          message: 'Continued in a fresh deep-review execution',
          finishedAt: now,
        },
        reviewer.id,
        'Continued deep review in a fresh execution',
      );
    }
    context.board.record(
      'deep_review',
      report,
      'user',
      original ? 'Resumed deep resume review' : 'Requested deep resume review',
    );
    context.board.record('run', run, reviewer.id, 'Started managed deep review');
    context.board.record('run', writerReservation, writer.id, writerReservation.message);
    context.board.updateCard(
      cardId,
      { owner: reviewer.id, packetReview: undefined },
      reviewer.id,
      'Claimed application for deep review',
    );
  })();
  context.controllers.set(run.id, controller);
  context.controllers.set(writerReservation.id, controller);
  context.deepReviewExecutions.set(id, live);
  void executeDeepReview(context, live, run);
  return run;
}
export function cancelWaitingDeepReview(context: CrewContext, id: string) {
  const report = review(context, id);
  if (report.status !== 'waiting') return;
  updateReview(
    context,
    id,
    {
      status: 'cancelled',
      summary: 'Deep review cancelled.',
      finishedAt: new Date().toISOString(),
    },
    'Deep review cancelled',
  );
  const run = context.board.get<Run>('run', report.runId);
  context.board.record(
    'run',
    { ...run, status: 'cancelled', message: 'Deep review cancelled.' },
    'user',
    'Cancelled waiting deep review',
  );
}

export function startDeepReview(...args: Parameters<typeof startDeepReviewPrepared>) {
  const [context, , input] = args;
  const options = deepReviewOptionsSchema.parse(input ?? {});
  const reviewer = workflowRole(context, 'reviewer', options.reviewerId);
  const writer = workflowRole(context, 'writer', options.writerId);
  return context.runtimeMaintenance.guard(reviewer, () =>
    context.runtimeMaintenance.guard(writer, () => {
      const currentReviewer = workflowRole(context, 'reviewer', options.reviewerId);
      const currentWriter = workflowRole(context, 'writer', options.writerId);
      if (
        currentReviewer.runtime !== reviewer.runtime ||
        currentReviewer.model !== reviewer.model ||
        currentWriter.runtime !== writer.runtime ||
        currentWriter.model !== writer.model
      )
        throw new RuntimeHeldError(
          'Review runtime settings changed. Retry with the current settings.',
        );
      return startDeepReviewPrepared(...args);
    }),
  );
}
