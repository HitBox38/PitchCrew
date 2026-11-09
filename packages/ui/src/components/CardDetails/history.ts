import { activitySentence, type NameOf } from '@/ActivityPage/labels.ts';
import { runtimeLabels } from '@/lib/labels.ts';
import type { JobHistoryEvent } from './hooks/useJobHistory.ts';

/** Stored wording for ownership and saving steps that never change what the user sees. */
const bookkeeping = new Set([
  'Released application',
  'Released deep-review application',
  'Claimed application for deep review',
  'Saved turn activity',
  'Consumed approval for local export',
  'Recorded memory sources',
  'Recorded run Profile version',
]);
const runProgress = new Set([
  'Agent started. Preparing a reply…',
  'Preparing a deterministic demo reply.',
  'Running the deterministic demo workflow.',
]);

/** Anything that sounds like a problem stays in the main history, whatever its kind. */
const problem = /fail|error|interrupt|cancel|stopp|could not|couldn’t|can't|cannot|invalid|retry/iu;

/**
 * Whether a history row is technical bookkeeping. Only clearly known wording and in-progress
 * run updates qualify; unknown messages, failures and finished runs stay in the main history.
 */
export const technicalHistory = (event: JobHistoryEvent) => {
  const message = event.message.trim();
  if (event.runStatus && ['failed', 'interrupted', 'cancelled'].includes(event.runStatus))
    return false;
  if (problem.test(message)) return false;
  if (bookkeeping.has(message)) return true;
  if (event.kind === 'card' && / claimed this application$/u.test(message)) return true;
  const started = /^Started .+ on (\S+)$/u.exec(message);
  return (
    event.kind === 'run' &&
    event.runStatus === 'running' &&
    (runProgress.has(message) ||
      / started a chat turn$/u.test(message) ||
      Boolean(started && started[1] in runtimeLabels))
  );
};

/** Splits newest-first history into the rows worth reading and the technical record. */
export const splitJobHistory = (events: JobHistoryEvent[]) => ({
  meaningful: events.filter((event) => !technicalHistory(event)),
  technical: events.filter(technicalHistory),
});

/** The product sentence for a meaningful row; unknown wording passes through unchanged. */
export const historySentence = (event: JobHistoryEvent, nameOf: NameOf) =>
  activitySentence(event, nameOf);
