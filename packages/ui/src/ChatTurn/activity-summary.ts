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
 * exactly, never guessed from order, so a parallel non-browser call keeps its own state. A
 * request that has been asked ("Asked to click …") but not yet carried out waits too, whatever
 * the agent does next: only its latest row, since an earlier identical request may have lapsed.
 */
export const blockedSteps = (entries: RunActivity[], labels: readonly string[] | undefined) => {
  const tools = entries.filter((entry) => entry.kind === 'tool');
  const running = tools.filter(
    (entry) => entry.status === 'running' && labels?.includes(entry.label),
  );
  const asked = (labels ?? [])
    .filter((label) => label.startsWith('Asked to '))
    .map((label) =>
      tools.findLast((entry) => entry.label === label && entry.status === 'completed'),
    )
    .filter((entry) => !!entry);
  return new Set([...running, ...asked].map((entry) => entry.id));
};
