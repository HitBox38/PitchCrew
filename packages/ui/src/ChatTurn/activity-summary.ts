import type { Run, RunActivity } from '@pitchcrew/core';
import { isUserControlPause } from '@pitchcrew/core/browser-errors';

/** Keep live context bounded across alternating commentary and tool batches. */
export const activityPreview = (run: Run): RunActivity[] => {
  const entries = run.activity ?? [];
  if (run.status !== 'running') {
    const issue =
      entries.findLast((entry) => entry.status === 'failed') ??
      entries.findLast((entry) => entry.status === 'interrupted' && !isUserControlPause(entry));
    return issue ? [issue] : [];
  }
  const commentary = entries.findLast((entry) => entry.kind === 'commentary' && entry.text?.trim());
  const step =
    entries.findLast((entry) => entry.kind !== 'commentary' && entry.status === 'running') ??
    entries.findLast((entry) => entry.kind !== 'commentary');
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
  const paused = entries.filter(isUserControlPause).length;
  return [
    steps ? `${steps} ${steps === 1 ? 'step' : 'steps'}` : '',
    updates ? `${updates} ${updates === 1 ? 'update' : 'updates'}` : '',
    failed ? `${failed} failed` : '',
    interrupted ? `${interrupted} interrupted` : '',
    paused ? 'paused for you' : '',
  ]
    .filter(Boolean)
    .join(' · ');
};
