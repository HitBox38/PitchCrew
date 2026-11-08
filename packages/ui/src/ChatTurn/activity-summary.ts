import type { Run, RunActivity } from '@pitchcrew/core';
import { isUserControlPause } from '@pitchcrew/core/browser-errors';

/**
 * Keep live context bounded across alternating commentary and tool batches. While the run waits
 * on the user, the step shown is the last one that finished: the call blocked on them is not work.
 */
/**
 * The collapsed turn's commentary and one step. A request awaiting the user's OK shows its own
 * step (`asked`: the ids blockedSteps found), so the preview reads the same whether or not the
 * agent has started waiting on it; while the user holds the page, the last finished step.
 */
export const activityPreview = (
  run: Run,
  waiting = false,
  asked?: ReadonlySet<string>,
): RunActivity[] => {
  const entries = run.activity ?? [];
  if (run.status !== 'running') {
    const issue =
      entries.findLast((entry) => entry.status === 'failed') ??
      entries.findLast((entry) => entry.status === 'interrupted' && !isUserControlPause(entry));
    return issue ? [issue] : [];
  }
  const commentary = entries.findLast((entry) => entry.kind === 'commentary' && entry.text?.trim());
  const request = asked?.size ? entries.findLast((entry) => asked.has(entry.id)) : undefined;
  const step = request
    ? request
    : waiting
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
 * the agent does next. Once its call runs, that running row is the one waiting; until then only
 * the turn's single latest asked row, since an earlier identical request may have lapsed.
 * Computed once over the whole turn and passed down, never per group of steps.
 */
export const blockedSteps = (
  entries: RunActivity[],
  labels: readonly string[] | undefined,
): ReadonlySet<string> => {
  const tools = entries.filter((entry) => entry.kind === 'tool');
  const running = tools.filter(
    (entry) => entry.status === 'running' && labels?.includes(entry.label),
  );
  if (running.length) return new Set(running.map((entry) => entry.id));
  const asked = (labels ?? []).filter((label) => label.startsWith('Asked to '));
  const latest = tools.findLast(
    (entry) => entry.status === 'completed' && asked.includes(entry.label),
  );
  return new Set(latest ? [latest.id] : []);
};
