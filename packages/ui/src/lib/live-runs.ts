import type { Run, Snapshot } from '@pitchcrew/core';
import { executingRuns } from './work-queue.ts';

export type LiveRuns = {
  /** Every run by id, with the chat stream's live copy laid over the saved one. */
  runs: Map<string, Run>;
  /** Runs executing on each job, oldest first; review-seat reservations hold a slot but never run. */
  byCard: Map<string, Run[]>;
};

/** A status never goes back: a run settles after it waits, and waits after it runs. */
const progress = (status: Run['status']) =>
  status === 'running' ? 0 : status === 'waiting' ? 1 : 2;

/**
 * The snapshot carries runs without their activity; the chat stream's `activityRuns` (merged by
 * the shell) carry each live run's latest public step, so `runActivityLabel` can show it instead of
 * the saved message. Whichever copy has moved further keeps its status and finish time, so a
 * stream copy that missed its final update never shows a finished run as executing.
 */
export const liveRunIndex = (data: Snapshot): LiveRuns => {
  const runs = new Map(data.runs.map((run) => [run.id, run]));
  for (const live of data.activityRuns ?? []) {
    const saved = runs.get(live.id);
    const merged: Run = { ...saved, ...live };
    if (saved && progress(saved.status) > progress(live.status)) {
      merged.status = saved.status;
      merged.finishedAt = saved.finishedAt;
    }
    runs.set(live.id, merged);
  }
  const byCard = new Map<string, Run[]>();
  const executing = executingRuns([...runs.values()]).toSorted((a, b) =>
    a.startedAt.localeCompare(b.startedAt),
  );
  for (const run of executing) {
    if (!run.cardId) continue;
    const list = byCard.get(run.cardId);
    if (list) list.push(run);
    else byCard.set(run.cardId, [run]);
  }
  return { runs, byCard };
};
