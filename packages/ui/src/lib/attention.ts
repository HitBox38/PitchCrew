import type {
  Approval,
  Card,
  ChatRequest,
  RemoteMcpRequest,
  Run,
  Snapshot,
  WorkQueueView,
} from '@pitchcrew/core';
import { runtimeTimeLimit } from '@pitchcrew/core/run-limits';
import { packetNeedsAction } from './inbox.ts';
import { pendingInstructionUpdates } from './instruction-updates.ts';
import { jobStep, snapshotStepFacts } from './job-step.ts';
import { packetStage, type PacketStage } from './packet-stage.ts';
import { pendingSkillUpdates } from './skill-updates.ts';
import { queueFailed } from './work-queue.ts';

// Everything that waits on the user before work or a change can move on (CONTEXT.md "Attention
// item"), ranked. Every Needs you count in the app derives from this one list. Pure and zod-free:
// it reads the workspace snapshot and the remote connection requests the notification center
// already polls, and no clock.

export type AttentionTier = 1 | 2 | 3 | 4 | 5;
export type AttentionKind =
  // 1 · ends soon or stops the crew
  | 'browser'
  | 'connection'
  | 'profile-recovery'
  // 2 · queued work waits on you (a blocking brief is promoted here)
  | 'question'
  | 'failure'
  | 'verify'
  | 'blocked'
  // 3 · your move on a job
  | 'packet'
  | 'brief'
  | 'export'
  // 4 · a record to confirm
  | 'tracking'
  // 5 · changes nothing until you adopt it
  | 'role-proposal'
  | 'skill-proposal'
  | 'instruction-update'
  | 'skill-update'
  | 'writing-suggestion'
  | 'profile-proposal';
export type AttentionDecides = 'in-place' | 'form' | 'page';
export type AttentionVerb =
  | 'approve'
  | 'reject'
  | 'details'
  | 'answer'
  | 'cancel'
  | 'open-conversation'
  | 'retry'
  | 'skip'
  | 'verify-in-job'
  | 'open-job'
  | 'open-queue'
  | 'approve-packet'
  | 'request-changes'
  | 'reject-packet'
  | 'not-applying'
  | 'agent-prepare'
  | 'export-manual'
  | 'record-submitted'
  | 'open-application'
  | 'continue-application'
  | 'review-brief'
  | 'request-export'
  | 'apply-update'
  | 'reject-update'
  | 'refresh-comparison'
  | 'apply-changes'
  | 'decline'
  | 'add-skill'
  | 'compare'
  | 'review-update'
  | 'apply-suggestion'
  | 'dismiss'
  | 'review-on-profile'
  | 'review-in-settings';

export interface AttentionItem {
  /** `${kind}:${entityId}`: stable across snapshots; the row key and the `?item=` value. */
  key: string;
  kind: AttentionKind;
  tier: AttentionTier;
  /** The record the deciding component reads (approval, input, queue, attempt, card, signal…). */
  entityId: string;
  /** The job. */
  cardId: string | null;
  /** The agent that asks; the proposer for crew changes. */
  roleId: string | null;
  /** The agent (role id) or skill (proposal: skill name; update: skill id) a change alters. */
  targetId: string | null;
  /** The conversation to open, when there is one. */
  threadId: string | null;
  /** The job or conversation queue it holds, when that queue is in the snapshot. */
  queueId: string | null;
  /** When the user's move began; '' when unknown (sorts last and shows no age). */
  askedAt: string;
  /** Run start plus the run limit (an estimate: say "about"), or a connection's expiry. */
  expiresAt: string | null;
  /** A live run holds a workspace slot while this waits (browser only). */
  holdsSlot: boolean;
  /** What stays stuck until the user acts. */
  blocks: 'crew' | 'run' | 'queue' | 'browser' | 'none';
  /** Bead law: rose only for failed work. */
  tone: 'ochre' | 'rose';
  decides: AttentionDecides;
  verbs: readonly AttentionVerb[];
  /** Packets only. */
  stage?: PacketStage;
  /** A failure's or hold's saved reason, shown verbatim. */
  reason?: string;
  /** Connections only: the app-provided name, always shown quoted. */
  name?: string;
}

/** A lane stopped for recovery that is not still executing (the app-bar chip's held-and-failed rule). */
export const recoveryQueue = (queue: Pick<WorkQueueView, 'paused' | 'pauseKind' | 'state'>) =>
  queue.paused &&
  (queue.pauseKind === 'failed' || queue.pauseKind === 'interrupted') &&
  queue.state !== 'running';

type Delivery = ChatRequest['deliveries'][number];

/**
 * The request a recovery queue stopped on and its stopped delivery: failed in a lane paused as
 * failed, paused with a run in one interrupted by a restart, else any stopped delivery.
 */
export const stoppedDelivery = (
  queue: Pick<WorkQueueView, 'pauseKind' | 'requests'>,
): { request: ChatRequest; delivery: Delivery } | undefined => {
  const wanted = (delivery: Delivery) =>
    queue.pauseKind === 'failed'
      ? delivery.status === 'failed'
      : delivery.status === 'paused' && !!delivery.runId;
  const stopped = (delivery: Delivery) =>
    delivery.status === 'failed' || delivery.status === 'paused';
  for (const test of [wanted, stopped])
    for (const request of queue.requests) {
      const delivery = request.deliveries.find(test);
      if (delivery) return { request, delivery };
    }
  return undefined;
};

/** A crew follow-up in the lane that failed and waits for Retry or Skip. */
export const failedFollowUp = (queue: Pick<WorkQueueView, 'tasks'>) =>
  queue.tasks.find((task) => task.status === 'failed');

// Fixed server hold messages that another item already explains, copied verbatim (typographic
// apostrophes included). A blocked queue is dropped only on an exact match with its explaining
// item present; if the server wording ever changes, both items show and no hold is hidden.
const briefHolds = [
  // packages/board/src/board/application-context.ts:48
  'Extract or prepare this job’s application brief first.',
  // packages/board/src/board/application-context.ts:59
  'Inspect the application form and confirm its requirements, or explicitly choose to check the form yourself.',
  // packages/board/src/board/application-context.ts:56
  'A saved form inspection supersedes any earlier form check. Review its findings in the application brief and confirm the brief.',
  // packages/board/src/board/application-context.ts:63
  'Review and confirm this job’s application brief before drafting.',
];
// packages/orchestrator/src/crew/queue/requests.ts:127
const verifyHold = 'Verify the previous submission outcome first.';
// packages/orchestrator/src/profile-sources/mutation.ts:12
const profileHold =
  'Finish the approved profile update on Profile before starting runs or editing notes.';

/** Statuses where an extracted brief still gates drafting, review or export. */
const briefStates: ReadonlySet<Card['state']> = new Set([
  'shortlisted',
  'drafting',
  'changes_requested',
  'in_review',
  'agreed',
  'awaiting_approval',
]);
/** Queued actions that check the confirmed brief and form before they start. */
const briefActions = new Set(['draft', 'review', 'deep-review']);

const packetVerbs: Record<Exclude<PacketStage, 'verify'>, readonly AttentionVerb[]> = {
  approve: ['approve-packet', 'request-changes', 'reject-packet', 'not-applying'],
  choose: ['agent-prepare', 'export-manual', 'not-applying'],
  apply: ['record-submitted', 'open-application', 'not-applying'],
  preparing: ['continue-application', 'not-applying'],
};

type Fields = Pick<AttentionItem, 'kind' | 'tier' | 'entityId' | 'askedAt' | 'decides' | 'verbs'> &
  Partial<Omit<AttentionItem, 'key'>>;
const item = (fields: Fields): AttentionItem => ({
  cardId: null,
  roleId: null,
  targetId: null,
  threadId: null,
  queueId: null,
  expiresAt: null,
  holdsSlot: false,
  blocks: 'none',
  tone: 'ochre',
  ...fields,
  key: `${fields.kind}:${fields.entityId}`,
});

/** Indices built once per call, so 150 jobs and a long run history stay cheap. */
const indexSnapshot = (data: Snapshot) => {
  const queues = data.queue?.queues ?? [];
  return {
    data,
    queues,
    cards: new Map(data.cards.map((card) => [card.id, card])),
    runs: new Map(data.runs.map((run) => [run.id, run])),
    requests: new Map((data.chatRequests ?? []).map((request) => [request.id, request])),
    queueById: new Map(queues.map((queue) => [queue.id, queue])),
    queueOfRun: new Map(
      queues.flatMap((queue) => queue.runs.map((run) => [run.id, queue] as const)),
    ),
    queueOfRequest: new Map(
      queues.flatMap((queue) => queue.requests.map((request) => [request.id, queue] as const)),
    ),
    runningCards: new Set(
      data.runs.flatMap((run) => (run.status === 'running' && run.cardId ? [run.cardId] : [])),
    ),
  };
};
type Index = ReturnType<typeof indexSnapshot>;

/** A lane id is `job:<cardId>` or `conversation:<threadId>`; only queues in the snapshot count. */
const laneIn = (index: Index, cardId: string | null, threadId?: string | null) => {
  const id = cardId ? `job:${cardId}` : threadId ? `conversation:${threadId}` : null;
  return id && index.queueById.has(id) ? id : null;
};

const finishedAt = (index: Index, runId: string | null | undefined) =>
  (runId ? index.runs.get(runId)?.finishedAt : null) || null;

const runEnds = (run: Run | undefined) => {
  const ends = run?.status === 'running' ? Date.parse(run.startedAt) + runtimeTimeLimit : NaN;
  return Number.isNaN(ends) ? null : new Date(ends).toISOString();
};

const browserItems = (index: Index) =>
  index.data.computerApprovals
    // Approved records still executing wait on the agent; automatic ones were never asked.
    .filter((approval) => approval.status === 'pending' && !approval.automatic)
    .map((approval) => {
      const run = index.runs.get(approval.runId);
      return item({
        kind: 'browser',
        tier: 1,
        entityId: approval.id,
        cardId: approval.cardId,
        roleId: approval.roleId,
        threadId: run?.threadId ?? null,
        queueId:
          (run && index.queueOfRun.get(run.id)?.id) ??
          (run ? laneIn(index, run.cardId, run.threadId) : null),
        askedAt: approval.createdAt,
        expiresAt: runEnds(run),
        holdsSlot: run?.status === 'running',
        blocks: 'run',
        decides: 'in-place',
        verbs: ['approve', 'reject', 'details'],
      });
    });

const connectionItems = (requests: readonly RemoteMcpRequest[]) =>
  requests.map((request) =>
    item({
      kind: 'connection',
      tier: 1,
      entityId: request.id,
      askedAt: request.createdAt,
      expiresAt: request.expiresAt,
      decides: 'page',
      verbs: ['review-in-settings'],
      name: request.name,
    }),
  );

const profileItems = (index: Index) =>
  (index.data.profileProposals ?? []).flatMap((proposal) =>
    // An approved update stuck in applying refuses every launch until it is retried.
    proposal.status === 'applying'
      ? [
          item({
            kind: 'profile-recovery',
            tier: 1,
            entityId: proposal.id,
            roleId: proposal.roleId,
            askedAt: proposal.decidedAt ?? proposal.createdAt,
            blocks: 'crew',
            decides: 'page',
            verbs: ['review-on-profile'],
          }),
        ]
      : proposal.status === 'pending'
        ? [
            item({
              kind: 'profile-proposal',
              tier: 5,
              entityId: proposal.id,
              roleId: proposal.roleId,
              askedAt: proposal.createdAt,
              decides: 'page',
              verbs: ['review-on-profile'],
            }),
          ]
        : [],
  );

const questionItems = (index: Index) =>
  (index.data.userInputs ?? [])
    .filter((input) => input.status === 'pending')
    .map((input) => {
      // The waiting lane, matched as `queueAnswerThread` does.
      const holds = (queue: WorkQueueView) =>
        queue.cardId
          ? queue.cardId === input.cardId
          : queue.threadId === input.threadId || queue.threadId === input.sourceThreadId;
      const queue =
        index.queues.find((entry) => entry.state === 'waiting' && holds(entry)) ??
        index.queues.find(holds);
      return item({
        kind: 'question',
        tier: 2,
        entityId: input.id,
        cardId: input.cardId,
        roleId: input.roleId,
        threadId: input.threadId,
        queueId: queue?.id ?? null,
        askedAt: input.createdAt,
        blocks: 'queue',
        decides: 'in-place',
        verbs: ['answer', 'cancel', 'open-conversation'],
      });
    });

const failureItems = (index: Index) =>
  // Never `state === 'paused'`: a lane paused as failed reports `waiting` while a question waits.
  index.queues.filter(recoveryQueue).map((queue) => {
    const stopped = stoppedDelivery(queue);
    const task = failedFollowUp(queue);
    return item({
      kind: 'failure',
      tier: 2,
      entityId: queue.id,
      cardId: queue.cardId,
      roleId: stopped?.delivery.roleId ?? task?.roleId ?? null,
      threadId: queue.threadId,
      queueId: queue.id,
      // Never `queue.updatedAt`: every queue write and every reorder stamps it.
      askedAt:
        finishedAt(index, stopped?.delivery.runId) ??
        finishedAt(index, task?.runId) ??
        queue.requests[0]?.createdAt ??
        '',
      blocks: 'queue',
      tone: queueFailed(queue) ? 'rose' : 'ochre',
      decides: 'in-place',
      verbs: ['retry', 'skip'],
      reason: stopped?.delivery.error || task?.error || queue.reason || undefined,
    });
  });

const verifyItems = (index: Index) =>
  index.data.cards.flatMap((card) =>
    (card.submissionAttempts ?? [])
      // Whatever the job's state: a status correction does not settle an unverified submission.
      .filter((attempt) => attempt.status === 'uncertain')
      .map((attempt) =>
        item({
          kind: 'verify',
          tier: 2,
          entityId: attempt.id,
          cardId: card.id,
          roleId: attempt.roleId,
          threadId: index.runs.get(attempt.runId)?.threadId ?? null,
          queueId: laneIn(index, card.id),
          askedAt: attempt.createdAt,
          blocks: 'browser',
          decides: 'form',
          verbs: ['verify-in-job'],
        }),
      ),
  );

const blockedItems = (index: Index, explained: (queue: WorkQueueView) => boolean) =>
  index.queues
    .filter((queue) => queue.state === 'blocked' && !explained(queue))
    .map((queue) => {
      const head = queue.requests[0];
      return item({
        kind: 'blocked',
        tier: 2,
        entityId: queue.id,
        cardId: queue.cardId,
        roleId: head?.deliveries.find((delivery) => delivery.status === 'queued')?.roleId ?? null,
        threadId: queue.threadId,
        queueId: queue.id,
        askedAt: head?.createdAt ?? '',
        blocks: 'queue',
        decides: 'page',
        verbs: [queue.cardId ? 'open-job' : 'open-conversation', 'open-queue'],
        reason: queue.reason,
      });
    });

/**
 * A handed-off preparation that no agent will move: its delivery is missing, finished or
 * cancelled, or stopped outside a recovery lane (Stop pauses the lane as the user's own). Moving
 * preparation is crew work, waiting preparation a question, and a failed or recovery-paused one
 * a failure item.
 */
const preparationStopped = (index: Index, approval: Approval) => {
  const request = index.requests.get(approval.submission?.requestId ?? '');
  const delivery = request?.deliveries[0];
  if (!request || !delivery) return true;
  if (delivery.status === 'completed' || delivery.status === 'cancelled') return true;
  if (delivery.status !== 'paused' && delivery.status !== 'failed') return false;
  const queue = index.queueOfRequest.get(request.id);
  return !queue || !recoveryQueue(queue);
};

const packetItems = (index: Index) =>
  index.data.approvals.flatMap((approval) => {
    const card = index.cards.get(approval.cardId);
    if (!card || !packetNeedsAction(approval, [card])) return [];
    const stage = packetStage(approval, card);
    // An uncertain submission is its own verify item.
    if (stage === 'verify') return [];
    if (stage === 'preparing' && !preparationStopped(index, approval)) return [];
    const verbs = packetVerbs[stage].filter((verb) => verb !== 'open-application' || !!card.url);
    return [
      item({
        kind: 'packet',
        tier: 3,
        entityId: approval.id,
        cardId: card.id,
        roleId: stage === 'preparing' ? (approval.submission?.roleId ?? null) : null,
        threadId: approval.submission?.threadId ?? null,
        queueId: laneIn(index, card.id),
        // Choosing and applying are the user's moves once the packet was approved.
        askedAt:
          stage === 'approve' ? approval.createdAt : (approval.decidedAt ?? approval.createdAt),
        decides: 'in-place',
        verbs,
        stage,
      }),
    ];
  });

/**
 * A brief gates drafting and review once the job is past Leads. It is promoted to tier 2 while
 * its job queue's next request is a draft, review or deep review that it holds: with every slot
 * busy the drain skips that queue without a reason, so it stays `ready` until a slot frees and
 * only then turns `blocked`. Missing answers gate export, never drafting, so they never promote.
 */
const briefItems = (index: Index) =>
  index.data.cards.flatMap((card) => {
    const context = card.applicationContext;
    if (!context || !briefStates.has(card.state)) return [];
    const facts = snapshotStepFacts(card, index.data.approvals);
    if (!facts.formMissing && facts.briefConfirmed && !facts.missingAnswers) return [];
    const queue = index.queueById.get(`job:${card.id}`);
    const head = queue?.requests[0];
    const promoted =
      (facts.formMissing || !facts.briefConfirmed) &&
      (queue?.state === 'ready' || queue?.state === 'blocked') &&
      briefActions.has(head?.boardAction ?? '');
    return [
      item({
        kind: 'brief',
        tier: promoted ? 2 : 3,
        entityId: card.id,
        cardId: card.id,
        queueId: promoted ? (queue?.id ?? null) : null,
        askedAt: context.createdAt ?? card.updatedAt,
        blocks: promoted ? 'queue' : 'none',
        decides: 'form',
        verbs: ['review-brief'],
      }),
    ];
  });

/**
 * A reviewed packet at rest that the server would let the user request export approval for:
 * the job step says export (form, brief, answers and a current review come first), no agent owns
 * or runs on the job, nothing is queued for it, and the user has not just rejected this packet.
 */
const exportItems = (index: Index) =>
  index.data.cards.flatMap((card) => {
    if (card.state !== 'agreed' || card.owner || index.runningCards.has(card.id)) return [];
    if (jobStep(card, snapshotStepFacts(card, index.data.approvals)) !== 'export') return [];
    if (index.queueById.get(`job:${card.id}`)?.requests.length) return [];
    const packet = JSON.stringify(card.packet);
    const rejected = index.data.approvals.some(
      (approval) =>
        approval.cardId === card.id &&
        approval.status === 'rejected' &&
        JSON.stringify(approval.packet) === packet,
    );
    if (rejected) return [];
    const review = card.packetReview;
    return [
      item({
        kind: 'export',
        tier: 3,
        entityId: card.id,
        cardId: card.id,
        roleId: (review?.runId && index.runs.get(review.runId)?.roleId) || null,
        askedAt: review?.reviewedAt ?? card.updatedAt,
        decides: 'form',
        verbs: ['request-export'],
      }),
    ];
  });

const trackingItems = (index: Index) =>
  (index.data.trackingSignals ?? [])
    .filter((signal) => signal.status === 'pending')
    .map((signal) =>
      item({
        kind: 'tracking',
        tier: 4,
        entityId: signal.id,
        cardId:
          signal.cardId ?? (signal.candidateIds.length === 1 ? signal.candidateIds[0]! : null),
        roleId: signal.roleId,
        askedAt: signal.createdAt,
        decides: 'in-place',
        verbs: ['apply-update', 'reject-update', 'refresh-comparison'],
      }),
    );

const changeItems = (index: Index) => {
  const { data } = index;
  const guide = data.quality?.writingGuide;
  return [
    ...data.proposals
      .filter((proposal) => proposal.status === 'pending')
      .map((proposal) =>
        item({
          kind: 'role-proposal',
          tier: 5,
          entityId: proposal.id,
          roleId: proposal.sourceRoleId ?? proposal.roleId,
          targetId: proposal.roleId,
          // The target agent's own chat shares its role id.
          threadId: proposal.roleId,
          askedAt: proposal.createdAt,
          decides: 'in-place',
          verbs: ['apply-changes', 'decline'],
        }),
      ),
    ...data.skillProposals
      .filter((proposal) => proposal.status === 'pending')
      .map((proposal) =>
        item({
          kind: 'skill-proposal',
          tier: 5,
          entityId: proposal.id,
          roleId: proposal.roleId,
          targetId: proposal.skill.name,
          threadId: proposal.threadId ?? proposal.roleId,
          askedAt: proposal.createdAt,
          decides: 'in-place',
          verbs: ['add-skill', 'decline'],
        }),
      ),
    ...pendingInstructionUpdates(data).map((update) => {
      // Shipped defaults carry only release dates (YYYY-MM-DD), as the bell reads them.
      const date = update.changes.reduce(
        (newest, change) => (change.date > newest ? change.date : newest),
        '',
      );
      return item({
        kind: 'instruction-update',
        tier: 5,
        entityId: update.roleId,
        roleId: update.roleId,
        targetId: update.roleId,
        askedAt: date ? `${date}T00:00:00.000Z` : '',
        decides: 'page',
        verbs: ['compare'],
      });
    }),
    ...pendingSkillUpdates(data).map((check) =>
      item({
        kind: 'skill-update',
        tier: 5,
        entityId: check.skillId,
        targetId: check.skillId,
        askedAt: check.detectedAt ?? check.checkedAt,
        decides: 'page',
        verbs: ['review-update'],
      }),
    ),
    ...(guide?.proposals ?? [])
      .filter((proposal) => proposal.status === 'pending')
      .map((proposal) =>
        item({
          kind: 'writing-suggestion',
          tier: 5,
          entityId: proposal.id,
          roleId: proposal.roleId,
          // Writing suggestions store no time; their run's start is the closest.
          askedAt: index.runs.get(proposal.runId)?.startedAt ?? '',
          decides: 'in-place',
          // A suggestion made against an older guide can only be dismissed.
          verbs:
            proposal.revision === guide?.revision ? ['apply-suggestion', 'dismiss'] : ['dismiss'],
        }),
      ),
  ];
};

type Ranked = Pick<AttentionItem, 'tier' | 'expiresAt' | 'askedAt' | 'key'>;
const instant = (iso: string | null) => {
  const ms = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
};

/**
 * The desk's order: tier; inside tier 1 the soonest expiry first (unknown last); then the oldest
 * ask (unknown last); then the key. A decided row's record sorts with the same fields, so it
 * stands where the row stood.
 */
export const attentionOrder = (a: Ranked, b: Ranked) =>
  a.tier - b.tier ||
  (a.tier === 1 ? instant(a.expiresAt) - instant(b.expiresAt) : 0) ||
  instant(a.askedAt) - instant(b.askedAt) ||
  (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/**
 * Whether an item's `askedAt` says when the user's move began. A new default instruction version
 * carries only its release date, ranked from midnight UTC, which says nothing about when it reached
 * this device: it only ranks the row, and no age, "oldest" or Since line is ever read from it.
 */
export const datedAsk = (item: Pick<AttentionItem, 'kind' | 'askedAt'>) =>
  !!item.askedAt && item.kind !== 'instruction-update';

/** Every attention item, ranked. */
export const attentionItems = (
  data: Snapshot,
  outside: { remoteRequests?: readonly RemoteMcpRequest[] } = {},
): AttentionItem[] => {
  const index = indexSnapshot(data);
  const profile = profileItems(index);
  const verify = verifyItems(index);
  const briefs = briefItems(index);
  const briefCards = new Set(briefs.map((entry) => entry.cardId));
  const verifyCards = new Set(verify.map((entry) => entry.cardId));
  const recovering = profile.some((entry) => entry.kind === 'profile-recovery');
  const explained = (queue: WorkQueueView) =>
    (briefHolds.includes(queue.reason) && briefCards.has(queue.cardId)) ||
    (queue.reason === verifyHold && verifyCards.has(queue.cardId)) ||
    (queue.reason === profileHold && recovering);
  return [
    ...browserItems(index),
    ...connectionItems(outside.remoteRequests ?? []),
    ...profile,
    ...questionItems(index),
    ...failureItems(index),
    ...verify,
    ...blockedItems(index, explained),
    ...packetItems(index),
    ...briefs,
    ...exportItems(index),
    ...trackingItems(index),
    ...changeItems(index),
  ].sort(attentionOrder);
};

const count = (items: readonly AttentionItem[], kinds: readonly AttentionKind[]) =>
  items.filter((entry) => kinds.includes(entry.kind)).length;

/** Every Needs you count from the one list: Home's badge, fact and heading, and the others. */
export const attentionCounts = (items: readonly AttentionItem[]) => ({
  home: items.length,
  crew: count(items, ['role-proposal', 'skill-proposal', 'instruction-update']),
  profile: count(items, ['profile-proposal', 'profile-recovery']),
  skills: count(items, ['skill-update']),
  failed: items.filter((entry) => entry.tone === 'rose').length,
});

/**
 * Exactly the snapshot slices `attentionItems` reads. The chat stream returns a new snapshot on
 * every tick while `shareEqual` keeps unchanged slices' identity, so comparing these skips the
 * work when only messages or live activity moved.
 */
const slices = (data: Snapshot) => [
  data.cards,
  data.runs,
  data.approvals,
  data.computerApprovals,
  data.userInputs,
  data.queue,
  data.trackingSignals,
  data.proposals,
  data.skillProposals,
  data.roles,
  data.quality,
  data.profileProposals,
  data.instructionUpdates,
  data.skillUpdates,
  data.skills,
  data.chatRequests,
];
const noRequests: readonly RemoteMcpRequest[] = [];
let last: { inputs: readonly unknown[]; items: readonly AttentionItem[] } | undefined;

/**
 * One computation per changed slice, shared by every caller (the shell's badge and Home read the
 * same array). Never sort or change the result in place.
 */
export const cachedAttention = (
  data: Snapshot,
  remoteRequests: readonly RemoteMcpRequest[] = noRequests,
): readonly AttentionItem[] => {
  const inputs = [...slices(data), remoteRequests];
  if (last?.inputs.length === inputs.length && last.inputs.every((input, i) => input === inputs[i]))
    return last.items;
  last = { inputs, items: attentionItems(data, { remoteRequests }) };
  return last.items;
};
