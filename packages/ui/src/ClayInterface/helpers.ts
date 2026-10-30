import type { CardState } from '@pitchcrew/core';

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

export type BeadState = 'done' | 'current' | 'todo';

export const trackBeads = (state: CardState): BeadState[] => {
  const current = trackIndex(state);
  return trackSteps.map((_, index) =>
    current === null || index > current ? 'todo' : index === current ? 'current' : 'done',
  );
};

export type BeadTone = 'primary' | 'plum' | 'ochre' | 'moss' | 'teal';

/** Bead colour for a job at rest; asks override it with ochre at the call site. */
export const stateTone = (state: CardState): BeadTone | undefined => {
  const index = trackIndex(state);
  if (index === null || index === 0) return undefined;
  if (index === 1) return 'primary';
  if (index === 5) return 'moss';
  return index === 4 ? 'ochre' : 'plum';
};

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
