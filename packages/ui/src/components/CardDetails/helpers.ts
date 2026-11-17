import { runLifecycle } from '@pitchcrew/core/lifecycles';
import type { Card, CardState, Run, Snapshot } from '@pitchcrew/core';
import { transitions, workflowSeat } from '@pitchcrew/core/states';
import type { ApplicationSection, JobAgent } from './types.ts';
import { packetNeedsReview } from '@/lib/job-step.ts';
import { questionAnswered } from '@/lib/question-wait.ts';
import { isolatesApplications } from '@/lib/runtimes.ts';

/** Stream activity overrides persisted activity without losing run identity. */
export const jobAgents = (cardId: string, data: Snapshot): JobAgent[] => {
  const runs = new Map(data.runs.map((run) => [run.id, run]));
  for (const run of data.activityRuns ?? []) runs.set(run.id, { ...runs.get(run.id), ...run });
  const active = [...runs.values()].filter(
    (run) =>
      run.cardId === cardId && runLifecycle.is('live', run.status) && !run.reviewSeatReservation,
  );
  // Answered turns stay waiting until their continuation chain finishes. Follow question
  // links rather than grouping by role or root, which can also contain independent work.
  const superseded = new Set<string>();
  for (const run of active) {
    let current: Run | undefined = run;
    const visited = new Set<string>();
    while (current?.requestId && !visited.has(current.id)) {
      visited.add(current.id);
      const question = data.userInputs?.find(
        (question) =>
          question.status === 'answered' &&
          question.continuationRequestId === current?.requestId &&
          question.roleId === run.roleId,
      );
      if (!question) break;
      superseded.add(question.runId);
      current = runs.get(question.runId);
    }
  }
  const agents = active
    // Deep-review coordinators mirror their workers, including when a worker asks a question.
    // Their rootRunId can point farther upstream; the report identifies this execution.
    .filter(
      (run) =>
        !(
          run.purpose === 'deep-review' &&
          run.deepReviewId &&
          active.some(
            (other) =>
              other.id !== run.id &&
              other.deepReviewId === run.deepReviewId &&
              other.purpose !== 'deep-review',
          )
        ),
    )
    .filter((run) => run.status !== 'waiting' || !superseded.has(run.id))
    .map((run): JobAgent => ({
      run,
      name: data.roles.find((role) => role.id === run.roleId)?.name ?? run.roleId,
      // Answered but its continuation has not started yet: nothing is left for the user.
      ...(run.status === 'waiting' && questionAnswered(run.id, data.userInputs)
        ? { handedOff: true }
        : {}),
    }));
  return agents.map((agent) => {
    const peers = agents.filter((other) => other.name === agent.name);
    if (peers.length < 2) return agent;
    const ordered = peers.toSorted(
      (a, b) => a.run.startedAt.localeCompare(b.run.startedAt) || a.run.id.localeCompare(b.run.id),
    );
    const conversation = data.conversations?.find((thread) => thread.id === agent.run.threadId);
    return {
      ...agent,
      detail: `Turn ${ordered.indexOf(agent) + 1} · ${conversation?.title ?? agent.run.message}`,
    };
  });
};
/** What an agent chip says: asking the user, handed back after an answer, or working. */
export const agentState = ({ run, handedOff }: JobAgent) =>
  run.status !== 'waiting' ? 'Running' : handedOff ? 'Answer saved' : 'Waiting for you';
export const turnPreview = (run: Run, handedOff = false) => {
  const commentary = run.activity?.findLast(
    (entry) => entry.kind === 'commentary' && entry.text?.trim(),
  );
  const step = run.activity?.findLast(
    (entry) => entry.status === 'running' && entry.kind !== 'commentary',
  );
  return {
    status:
      run.status === 'waiting'
        ? handedOff
          ? 'Answer saved'
          : 'Waiting for you'
        : (step?.label ?? run.message ?? 'Working…'),
    commentary: commentary?.text,
  };
};
export const jobRole = (data: Snapshot, seat: 'scout' | 'writer' | 'reviewer') => {
  return data.roles.find((role) => role.enabled && !role.retiredAt && workflowSeat(role) === seat);
};
export const launchBlocker = (data: Snapshot, roleId: string | undefined) => {
  const role = data.roles.find((role) => role.id === roleId);
  if (!role?.enabled || role.retiredAt) return 'Enable an application agent in Crew.';
  if (!isolatesApplications(data.runtimes, role.runtime))
    return 'Choose an isolated application runtime in Crew.';
  if (!data.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available))
    return 'Install this agent’s runtime in Settings.';
  if (!data.profile.some((note) => note.content.trim()))
    return 'Add your profile notes before starting the crew.';
  return null;
};
export { packetNeedsReview };

/** A later successful run clears an earlier failure from the persistent footer. */
export const latestJobFailure = (cardId: string, runs: Run[]) => {
  const latest = runs.reduce<Run | undefined>((current, run) => {
    if (run.cardId !== cardId || run.reviewSeatReservation) return current;
    return !current || (run.finishedAt ?? run.startedAt) > (current.finishedAt ?? current.startedAt)
      ? run
      : current;
  }, undefined);
  return latest?.status === 'failed' ? latest : undefined;
};

export type ApplicationRow = {
  id: ApplicationSection;
  title: string;
  status: string;
  done: boolean;
};

export const applicationRows = (
  card: Card,
  confirmed: boolean,
  exported: boolean,
  hasBrief = true,
): ApplicationRow[] => {
  const reviewed = Boolean(card.packetReview) && !packetNeedsReview(card);
  // An agreed or approved packet whose review no longer matches the brief is reviewed again.
  const stale =
    (card.state === 'agreed' || card.state === 'awaiting_approval') && packetNeedsReview(card);
  // A review that asked for changes leaves the documents to revise, not a reviewed packet.
  const revising = card.state === 'changes_requested' && Boolean(card.packet);
  return [
    {
      id: 'brief',
      title: 'Brief and requirements',
      status: confirmed ? 'Confirmed' : hasBrief ? 'Needs review' : 'Not prepared',
      done: confirmed,
    },
    {
      id: 'documents',
      title: 'Documents',
      // `exported` means these exact saved documents were exported; a later edit reads as a draft.
      status: !card.packet
        ? 'Not drafted'
        : revising
          ? 'Revision needed'
          : exported
            ? 'Exported version'
            : 'Draft available',
      done: Boolean(card.packet) && !revising,
    },
    {
      id: 'reviews',
      title: 'Reviews',
      status: revising
        ? 'Changes requested'
        : reviewed
          ? 'Reviewed'
          : stale
            ? 'Review again'
            : card.packet
              ? 'Review needed'
              : 'Not reviewed',
      done: reviewed,
    },
    {
      id: 'export',
      title: 'Export',
      status: exported
        ? 'Exported'
        : card.state === 'awaiting_approval'
          ? 'Approval requested'
          : 'Not exported',
      done: exported,
    },
  ];
};

type StepActivity = { name: string; section?: ApplicationSection };

/** The ledger step a run works on; fit, packet rating and chat turns belong to no step. */
export const runSection = (run: Run): ApplicationSection | undefined => {
  if (run.deepReviewId) return 'reviews';
  if (run.purpose === 'source-extraction') return 'brief';
  if (run.purpose === 'application-draft') return 'documents';
  if (run.purpose === 'application-review') return 'reviews';
  return undefined;
};

/**
 * Each step says who holds it right now, matching the header and dock: an agent's question on
 * that step (ochre, "Reviewer asked you") or its live turn (plum, "Writer is working").
 */
export const liveApplicationSteps = (
  rows: ApplicationRow[],
  activity: { asking?: StepActivity; working?: StepActivity },
  state: BeadState = {},
) => {
  const beads = applicationBeads(rows, state);
  return rows.map((row, index) => {
    const { asking, working } = activity;
    if (asking && asking.section === row.id)
      return { row: { ...row, status: `${asking.name} asked you` }, bead: 'ochre', live: false };
    if (working && working.section === row.id)
      return { row: { ...row, status: `${working.name} is working` }, bead: 'plum', live: true };
    return { row, bead: beads[index], live: false };
  });
};

/** A closed job, and the kinds of decision (from the header's signals) that wait on the user. */
type BeadState = { closed?: boolean; waiting?: ReadonlySet<string> };
// The decision kind each step owns: confirming the brief, approving the exact packet files.
const stepDecisions: Partial<Record<ApplicationSection, string>> = {
  brief: 'brief',
  export: 'packet',
};

/**
 * Bead per application step: done, the first unfinished step as current, then to do. The current
 * step is ochre only when its own decision waits on the user, by the same rule as the header's
 * track, so a lead or a brief not yet extracted stays a neutral ring. A closed job has no current
 * step: nothing waits on anyone.
 */
export const applicationBeads = (rows: ApplicationRow[], { closed, waiting }: BeadState = {}) => {
  if (closed) return rows.map((row) => (row.done ? 'done' : undefined));
  const current = rows.findIndex((row) => !row.done);
  const asks = (row: ApplicationRow) => waiting?.has(stepDecisions[row.id] ?? '') ?? false;
  return rows.map((row, index) =>
    row.done ? 'done' : index === current ? (asks(row) ? 'ochre' : 'current') : undefined,
  );
};

// Only outcomes are recorded by hand; workflow and review moves belong to the dock and the crew.
const manualOutcomes: CardState[] = [
  'withdrawn',
  'rejected',
  'ghosted',
  'screening',
  'interviewing',
  'offer',
];
/** The statuses a user can record from Activity's Change… menu in this state. */
export const outcomeTargets = (state: CardState) =>
  transitions[state].filter((target) => manualOutcomes.includes(target));

// Scout is asked to say a score isn't an offer probability; that caveat shouldn't lead its notes.
const scoreCaveat = /\b(probability|chance) of (an? )?(offer|hire|hiring|interview)|hiring chance/i;
/** Scout's notes with the first substantive one first; the rest keep their order. */
export const leadNotes = (notes: string[]) => {
  const lead = notes.findIndex((note) => !scoreCaveat.test(note));
  return lead <= 0 ? notes : [notes[lead], ...notes.filter((_, index) => index !== lead)];
};
