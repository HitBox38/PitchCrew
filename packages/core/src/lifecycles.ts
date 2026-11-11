// Zod-free lifecycle tables, safe to import from the UI bundle.
// Every persisted status lives here: its values, the only moves between them and the named
// status sets callers share. The board checks every write against them (board/lifecycle.ts) and
// docs/state-machines.md is generated from them.
import { transitions } from './states.ts';

/** A status changed along an edge its lifecycle table does not declare. */
export class LifecycleError extends Error {
  readonly lifecycle: string;
  readonly from: string;
  readonly to: string;
  readonly allowed: readonly string[];
  constructor(lifecycle: string, from: string, to: string, allowed: readonly string[]) {
    super(
      `${lifecycle} cannot go from ${from} to ${to}. ${
        allowed.length ? `From ${from} it can become: ${allowed.join(', ')}.` : `${from} is final.`
      }`,
    );
    this.name = 'LifecycleError';
    this.lifecycle = lifecycle;
    this.from = from;
    this.to = to;
    this.allowed = allowed;
  }
}

export interface Lifecycle<S extends string, G extends string = never> {
  /** Readable entity name used in errors and generated documentation. */
  name: string;
  states: readonly S[];
  /** Statuses a new entity may be created with. */
  initial: readonly S[];
  /** Every declared edge. Saving an entity without changing its status is always allowed. */
  graph: Readonly<Record<S, readonly S[]>>;
  /** Statuses with no way out. */
  final: readonly S[];
  /** Named status sets, so callers stop spelling the same list by hand. */
  groups: Readonly<Record<G, readonly S[]>>;
  next: (from: S) => readonly S[];
  can: (from: S, to: S) => boolean;
  canStart: (status: S) => boolean;
  assert: (from: S, to: S) => void;
  isFinal: (status: S) => boolean;
  is: (group: G, status: S) => boolean;
}

/**
 * Declare one entity's statuses and the only moves between them.
 * The table is the single source for guards, status sets and docs/state-machines.md.
 */
export const defineLifecycle = <const S extends string, const G extends string = never>(
  name: string,
  definition: {
    initial: readonly NoInfer<S>[];
    graph: Record<S, readonly NoInfer<S>[]>;
    groups?: Record<G, readonly NoInfer<S>[]>;
  },
): Lifecycle<S, G> => {
  const states = Object.keys(definition.graph) as S[];
  const graph = definition.graph;
  const groups = (definition.groups ?? {}) as Record<G, readonly S[]>;
  const final = states.filter((state) => !graph[state].length);
  const next = (from: S): readonly S[] => graph[from] ?? [];
  const can = (from: S, to: S): boolean => from === to || next(from).includes(to);
  return {
    name,
    states,
    initial: definition.initial,
    graph,
    final,
    groups,
    next,
    can,
    canStart: (status) => definition.initial.includes(status),
    assert: (from, to) => {
      if (!can(from, to)) throw new LifecycleError(name, from, to, next(from));
    },
    isFinal: (status) => final.includes(status),
    is: (group, status) => groups[group].includes(status),
  };
};

/** The normal workflow graph. User and `manageWorkflow` corrections may record any status. */
export const cardLifecycle = defineLifecycle('Job', {
  initial: ['lead'],
  graph: transitions,
  groups: {
    /** Before any submission was recorded. */
    preparing: [
      'lead',
      'shortlisted',
      'drafting',
      'in_review',
      'changes_requested',
      'agreed',
      'awaiting_approval',
    ],
    /** Submitted and still moving through the employer's process. */
    applied: ['submitted', 'screening', 'interviewing', 'offer'],
    closed: ['rejected', 'withdrawn', 'ghosted'],
  },
});

/** One runtime turn. A question parks it as waiting until its continuation settles. */
export const runLifecycle = defineLifecycle('Run', {
  initial: ['running'],
  graph: {
    running: ['waiting', 'completed', 'failed', 'cancelled'],
    waiting: ['completed', 'failed', 'cancelled'],
    completed: [],
    failed: [],
    cancelled: [],
  },
  groups: {
    /** Still owns its job or conversation: executing, or parked on a question. */
    live: ['running', 'waiting'],
    settled: ['completed', 'failed', 'cancelled'],
  },
});

/** A crew follow-up one agent queued for another. */
export const taskLifecycle = defineLifecycle('Crew task', {
  initial: ['queued'],
  graph: {
    queued: ['running', 'failed', 'cancelled'],
    running: ['waiting', 'completed', 'failed', 'cancelled'],
    waiting: ['completed', 'cancelled'],
    // Retry requeues a failed follow-up; Skip cancels it.
    failed: ['queued', 'cancelled'],
    completed: [],
    cancelled: [],
  },
  groups: {
    /** Not finished and not waiting for Retry or Skip. */
    live: ['queued', 'running', 'waiting'],
    /** Holds its lane: executing, or parked on a question. */
    engaged: ['running', 'waiting'],
    /** Daemon startup has to reconcile these. */
    recoverable: ['queued', 'running'],
    settled: ['completed', 'failed', 'cancelled'],
  },
});

/** One recipient's copy of a user request. */
export const deliveryLifecycle = defineLifecycle('Message delivery', {
  initial: ['queued', 'paused'],
  graph: {
    queued: ['running', 'paused', 'cancelled'],
    // Busy or held launches return to queued; Stop pauses; a question parks as waiting.
    running: ['queued', 'waiting', 'completed', 'paused', 'failed', 'cancelled'],
    waiting: ['completed', 'failed', 'cancelled'],
    paused: ['queued', 'completed', 'cancelled'],
    // Retry requeues; Skip or Remove cancels; editing it while the queue is stopped keeps it paused.
    failed: ['queued', 'paused', 'cancelled'],
    completed: [],
    cancelled: [],
  },
  groups: {
    /** Nothing more will happen. Everything else keeps its request pending. */
    done: ['completed', 'cancelled'],
    /** Never reached an agent, or stopped before it finished: the user may edit or remove it. */
    unsent: ['queued', 'paused', 'failed'],
    /** Stopped until the user resumes, retries or skips. */
    stopped: ['paused', 'failed'],
    /** Holds its lane: executing, or parked on a question. */
    engaged: ['running', 'waiting'],
    /** Will run, or is running, without the user doing anything. */
    moving: ['queued', 'running'],
  },
});

/** A packet export approval. Changed packets, briefs and statuses reject unused ones. */
export const approvalLifecycle = defineLifecycle('Packet approval', {
  initial: ['pending'],
  graph: {
    pending: ['approved', 'rejected'],
    approved: ['consumed', 'rejected'],
    consumed: [],
    rejected: [],
  },
  groups: {
    /** Unused: still decidable or usable, so it must be invalidated when its inputs change. */
    open: ['pending', 'approved'],
    /** The user said yes, whether or not the export ran yet. */
    granted: ['approved', 'consumed'],
  },
});

/** One exact browser action. Automatic preparation creates it already approved. */
export const computerApprovalLifecycle = defineLifecycle('Browser action approval', {
  initial: ['pending', 'approved'],
  graph: {
    pending: ['approved', 'rejected'],
    // A changed page or upload fails the approval before it is consumed, so it is never reused.
    approved: ['consumed', 'rejected', 'failed'],
    // Consumed before side effects; a failed execution is recorded afterwards.
    consumed: ['failed'],
    rejected: [],
    failed: [],
  },
  groups: {
    open: ['pending', 'approved'],
    /** The action was attempted, whatever the result. */
    used: ['consumed', 'failed'],
  },
});

/** A question that ends the asking turn and holds its queue. */
export const userInputLifecycle = defineLifecycle('Question', {
  initial: ['pending'],
  graph: {
    pending: ['answered', 'cancelled'],
    // An answer whose continuation never finished can still be cancelled by Stop or removal.
    answered: ['cancelled'],
    cancelled: [],
  },
});

/** A managed deep resume review. Waiting and failed reviews can be resumed. */
export const deepReviewLifecycle = defineLifecycle('Deep review', {
  initial: ['running'],
  graph: {
    running: ['waiting', 'completed', 'needs_changes', 'failed', 'cancelled'],
    waiting: ['running', 'failed', 'cancelled'],
    failed: ['running'],
    completed: [],
    needs_changes: [],
    cancelled: [],
  },
  groups: {
    live: ['running', 'waiting'],
    resumable: ['waiting', 'failed'],
  },
});

/** An optional targeted opinion inside a deep review. */
export const reviewSubagentLifecycle = defineLifecycle('Review subagent', {
  initial: ['running', 'unavailable'],
  graph: {
    running: ['completed', 'failed', 'cancelled'],
    completed: [],
    failed: [],
    cancelled: [],
    unavailable: [],
  },
});

/**
 * Delegates run, then one collection turn gathers every result. The open statuses are recomputed
 * from the round's tasks, so a requeued delegate can move a round back; settled rounds stay put.
 */
export const delegationRoundLifecycle = defineLifecycle('Delegation round', {
  initial: ['queued'],
  graph: {
    queued: ['running', 'collecting', 'completed', 'cancelled'],
    running: ['queued', 'collecting', 'completed', 'cancelled'],
    collecting: ['queued', 'running', 'completed', 'cancelled'],
    completed: [],
    cancelled: [],
  },
  groups: { settled: ['completed', 'cancelled'] },
});

/** Role, skill and writing proposals: only a user decision leaves pending. */
export const proposalLifecycle = defineLifecycle('Proposal', {
  initial: ['pending'],
  graph: { pending: ['applied', 'rejected'], applied: [], rejected: [] },
});

/** Profile updates pass through applying so an interrupted write can be retried. */
export const profileProposalLifecycle = defineLifecycle('Profile update', {
  initial: ['pending'],
  graph: {
    pending: ['applying', 'rejected'],
    applying: ['applied'],
    applied: [],
    rejected: [],
  },
});

/** An application status found in Gmail, applied automatically or held for review. */
export const trackingSignalLifecycle = defineLifecycle('Tracking signal', {
  initial: ['pending', 'applied', 'ignored'],
  graph: { pending: ['applied', 'rejected'], applied: [], ignored: [], rejected: [] },
});

/** A browser submission whose result the user still has to verify. */
export const submissionAttemptLifecycle = defineLifecycle('Submission attempt', {
  initial: ['uncertain'],
  graph: { uncertain: ['confirmed', 'not_submitted'], confirmed: [], not_submitted: [] },
});

type AnyLifecycle = Lifecycle<string, string>;

/** Board entity kinds whose `status` field follows a table. */
export const entityLifecycles = {
  run: runLifecycle,
  task: taskLifecycle,
  approval: approvalLifecycle,
  computer_approval: computerApprovalLifecycle,
  user_input: userInputLifecycle,
  deep_review: deepReviewLifecycle,
  review_subagent: reviewSubagentLifecycle,
  delegation_round: delegationRoundLifecycle,
  proposal: proposalLifecycle,
  skill_proposal: proposalLifecycle,
  profile_proposal: profileProposalLifecycle,
  tracking_signal: trackingSignalLifecycle,
  submission_attempt: submissionAttemptLifecycle,
} as const;

/** Every table, in the order docs/state-machines.md prints them. */
export const lifecycles: readonly AnyLifecycle[] = [
  cardLifecycle,
  runLifecycle,
  taskLifecycle,
  deliveryLifecycle,
  userInputLifecycle,
  approvalLifecycle,
  computerApprovalLifecycle,
  submissionAttemptLifecycle,
  deepReviewLifecycle,
  reviewSubagentLifecycle,
  delegationRoundLifecycle,
  proposalLifecycle,
  profileProposalLifecycle,
  trackingSignalLifecycle,
] as unknown as readonly AnyLifecycle[];
