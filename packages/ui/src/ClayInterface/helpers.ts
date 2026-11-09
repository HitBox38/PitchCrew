import type { CardState, ChatRequest, Run, RunActivity, UserInputRequest } from '@pitchcrew/core';
import type { PacketStage } from './packet-guidance.ts';

type ChatDelivery = ChatRequest['deliveries'][number];

export type TrackStep = { id: string; label: string; states: CardState[] };

// The bead track follows the normal workflow. Review and approval are split out
// from the board's grouped columns because they are where the user is asked to act.
export const trackSteps: TrackStep[] = [
  { id: 'lead', label: 'Lead', states: ['lead'] },
  { id: 'shortlisted', label: 'Shortlisted', states: ['shortlisted'] },
  { id: 'drafting', label: 'Drafting', states: ['drafting', 'changes_requested'] },
  { id: 'review', label: 'Review', states: ['in_review'] },
  { id: 'approve', label: 'You approve', states: ['agreed', 'awaiting_approval'] },
  { id: 'applied', label: 'Applied', states: ['submitted', 'screening', 'interviewing', 'offer'] },
];

/** Index of the current step, or null for closed jobs that left the workflow. */
export const trackIndex = (state: CardState): number | null => {
  const index = trackSteps.findIndex((step) => step.states.includes(state));
  return index === -1 ? null : index;
};

// The six-stage track keeps one Applied step; its label names the recorded outcome so
// moving to Interviewing visibly sticks without adding stages.
const appliedOutcomes: Partial<Record<CardState, string>> = {
  screening: 'Screening',
  interviewing: 'Interviewing',
  offer: 'Offer',
};

// Once a packet decision exists, the approval step names where it actually stands, so the track
// never asks for an approval the user already gave. Track labels stay short; the current step's
// full name is read by screen readers and shown beside the compact chat track.
const approveLabels: Record<PacketStage, { full: string; short: string }> = {
  approve: { full: 'You approve', short: 'You approve' },
  choose: { full: 'Choose how to apply', short: 'Approved' },
  apply: { full: 'Ready to apply', short: 'Ready to apply' },
  preparing: { full: 'Agent preparation', short: 'Preparation' },
  verify: { full: 'Verify submission', short: 'Verify' },
};

/**
 * A step's label for this job: the current Applied step names the recorded outcome and the current
 * approval step its packet stage (from `cardPacketStage`). `short` is for the labelled track row.
 * A passed approval step is named as a phase, never an instruction; it does not claim an approval
 * happened, since tracked or imported submissions can pass it without one.
 */
export const stepLabel = (state: CardState, index: number, stage?: PacketStage, short = false) => {
  const step = trackSteps[index];
  const current = trackIndex(state);
  if (step?.id === 'approve' && current !== null && current > index) return 'Approval';
  if (!step || current !== index) return step?.label ?? '';
  if (step.id === 'applied') return appliedOutcomes[state] ?? step.label;
  if (step.id === 'approve' && stage) return approveLabels[stage][short ? 'short' : 'full'];
  return step.label;
};

/**
 * The current bead's tone: ochre when the user is asked, plum while an agent executes. At rest the
 * approval step is the user's move (ochre) unless an agent is preparing the approved application.
 */
export const currentStageTone = (
  state: CardState,
  { asks, live, stage }: { asks?: boolean; live?: boolean; stage?: PacketStage },
): 'ochre' | 'plum' | 'current' => {
  if (asks) return 'ochre';
  if (live) return 'plum';
  return trackSteps[trackIndex(state) ?? -1]?.id === 'approve' && stage !== 'preparing'
    ? 'ochre'
    : 'current';
};

export type BeadState = 'done' | 'current' | 'todo';

export const trackBeads = (state: CardState): BeadState[] => {
  const current = trackIndex(state);
  return trackSteps.map((_, index) =>
    current === null || index > current ? 'todo' : index === current ? 'current' : 'done',
  );
};

/**
 * Bead law: plum only while an agent executes, ochre when the user is asked, primary for completed
 * steps, moss for a recorded positive outcome, rose for failure, an empty socket when idle or not
 * started. `current` is a job's present stage at rest: a neutral raised bead with a primary ring.
 */
export type BeadTone = 'primary' | 'plum' | 'ochre' | 'moss' | 'teal' | 'current';

/** A job's place at rest (no agent running, nothing asked): approval is the user's move. */
export const stateTone = (state: CardState): BeadTone | undefined => {
  const index = trackIndex(state);
  if (index === null || index === 0) return undefined;
  if (index === 5) return 'moss';
  return index === 4 ? 'ochre' : 'current';
};

/** A job's bead given what is happening on it: asked beats working beats its place at rest. */
export const jobBeadTone = (
  state: CardState,
  { asks, working, preparing }: { asks?: boolean; working?: boolean; preparing?: boolean },
): BeadTone | undefined =>
  asks ? 'ochre' : working ? 'plum' : preparing ? 'current' : stateTone(state);

/** A recorded status move: applied and later are positive outcomes, earlier moves completed steps. */
export const moveTone = (state: CardState) => (trackIndex(state) === 5 ? 'moss' : 'done');

export type TimelineRun = { id: string; left: number; width: number; live: boolean };

/**
 * Places today's runs on a 0–100 track that starts at 08:00 (or the first earlier run)
 * and ends now, so a glance shows when and how long each agent worked.
 */
export const timelineRuns = (
  runs: { id: string; startedAt: string; finishedAt: string | null; status: string }[],
  now: number,
) => {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  const today = runs.filter((run) => Date.parse(run.startedAt) >= day.getTime());
  const eight = day.getTime() + 8 * 3_600_000;
  const start = Math.min(eight, ...today.map((run) => Date.parse(run.startedAt)));
  const span = Math.max(now - start, 60_000);
  const placed: TimelineRun[] = today.map((run) => {
    const from = Date.parse(run.startedAt);
    const to = run.finishedAt ? Date.parse(run.finishedAt) : now;
    return {
      id: run.id,
      left: ((from - start) / span) * 100,
      width: Math.max(((to - from) / span) * 100, 1.5),
      live: run.status === 'running',
    };
  });
  return { start, runs: placed };
};

export type BeadStatus = Run['status'] | RunActivity['status'] | ChatDelivery['status'];

/**
 * Finished work is done, anything that needs the user (a question or a paused delivery) ochre and
 * failures rose; queued, stopped or interrupted work stays hollow.
 */
export const statusTone = (status: BeadStatus) =>
  status === 'completed'
    ? 'done'
    : status === 'waiting' || status === 'paused'
      ? 'ochre'
      : status === 'failed'
        ? 'rose'
        : undefined;

/** The most pressing state among a queued request's deliveries, for one bead per request. */
export const requestStatus = (statuses: ChatDelivery['status'][]): BeadStatus =>
  (['failed', 'paused', 'waiting', 'running', 'queued'] as const).find((status) =>
    statuses.includes(status),
  ) ?? 'completed';

/** Each participant with whether it is working in this conversation or waiting on the user. */
export const participantStates = (
  participants: string[],
  running: Pick<Run, 'roleId'>[],
  questions: Pick<UserInputRequest, 'roleId'>[],
) =>
  participants.map((id) => ({
    id,
    status: questions.some((question) => question.roleId === id)
      ? ('waiting' as const)
      : running.some((run) => run.roleId === id)
        ? ('running' as const)
        : undefined,
  }));
