import type { Run, RunActivity } from '@pitchcrew/core';
import { isUserControlPause } from '@pitchcrew/core/browser-errors';

/**
 * Keep live context bounded across alternating commentary and tool batches. While the run waits
 * on the user, the step shown is the last one that finished: the call blocked on them is not work.
 */
export const activityPreview = (run: Run, waiting = false): RunActivity[] => {
  const entries = run.activity ?? [];
  if (run.status !== 'running') {
    const issue =
      entries.findLast((entry) => entry.status === 'failed') ??
      entries.findLast((entry) => entry.status === 'interrupted' && !isUserControlPause(entry));
    return issue ? [issue] : [];
  }
  const commentary = entries.findLast((entry) => entry.kind === 'commentary' && entry.text?.trim());
  const step = waiting
    ? entries.findLast((entry) => entry.kind !== 'commentary' && entry.status !== 'running')
    : (entries.findLast((entry) => entry.kind !== 'commentary' && entry.status === 'running') ??
      entries.findLast((entry) => entry.kind !== 'commentary'));
  const ids = new Set([commentary?.id, step?.id]);
  return entries.filter((entry) => ids.has(entry.id));
};

export const activitySummary = (entries: RunActivity[]) => {
  const steps = entries.filter((entry) => entry.kind !== 'commentary').length;
  const updates = entries.filter(
    (entry) => entry.kind === 'commentary' && entry.text?.trim(),
  ).length;
  const failed = entries.filter((entry) => entry.status === 'failed').length;
  const interrupted = entries.filter(
    (entry) => entry.status === 'interrupted' && !isUserControlPause(entry),
  ).length;
  // Waits for the user's control can repeat or interleave with other steps within one takeover,
  // so the summary says it happened rather than claiming a count it cannot know.
  const paused = entries.some(isUserControlPause);
  return [
    steps ? `${steps} ${steps === 1 ? 'step' : 'steps'}` : '',
    updates ? `${updates} ${updates === 1 ? 'update' : 'updates'}` : '',
    failed ? `${failed} failed` : '',
    interrupted ? `${interrupted} interrupted` : '',
    paused ? 'paused while you had control' : '',
  ]
    .filter(Boolean)
    .join(' · ');
};

/**
 * The steps blocked on the user: running tool calls whose labels are the ones that wait on them
 * (the waiting request's own call, or every browser call while they hold the page). Matched
 * exactly, never guessed from order, so a parallel non-browser call keeps its own state.
 */
export const blockedSteps = (entries: RunActivity[], labels: readonly string[] | undefined) =>
  new Set(
    labels?.length
      ? entries
          .filter(
            (entry) =>
              entry.kind === 'tool' && entry.status === 'running' && labels.includes(entry.label),
          )
          .map((entry) => entry.id)
      : [],
  );
