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
  // One takeover can span several waits for the user; count takeovers, not waits.
  const tools = entries.filter((entry) => entry.kind !== 'commentary');
  const paused = tools.filter(
    (entry, index) => isUserControlPause(entry) && !(index && isUserControlPause(tools[index - 1])),
  ).length;
  return [
    steps ? `${steps} ${steps === 1 ? 'step' : 'steps'}` : '',
    updates ? `${updates} ${updates === 1 ? 'update' : 'updates'}` : '',
    failed ? `${failed} failed` : '',
    interrupted ? `${interrupted} interrupted` : '',
    paused === 1 ? 'you took over once' : paused > 1 ? `you took over ${paused} times` : '',
  ]
    .filter(Boolean)
    .join(' · ');
};
