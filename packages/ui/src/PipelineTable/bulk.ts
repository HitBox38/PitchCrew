import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { seatBlocker } from '@/BoardPage/components/JobActionsMenu/helpers.ts';
import { headStartBlock } from '@/lib/agent-start.ts';
import { stoppedDelivery, type AttentionItem } from '@/lib/attention.ts';
import { readyLine } from '@/lib/ready-line.ts';
import { roleName } from '@/lib/run-labels.ts';
import { ordinal } from '@/lib/text.ts';
import { clockLabel } from '@/lib/time.ts';
import { queueFailed } from '@/lib/work-queue.ts';
import type { BulkOutcome } from './types.ts';

// Bulk Evaluate fit, checked from the snapshot before anything is sent. Workspace reasons stop the
// whole batch once (never read from one selected job); each job is then queued, found already
// queued, not sent with the reason the single action or the server gives, or unconfirmed when its
// call got no answer and the refreshed snapshot does not show its request. Nothing here decides,
// approves or sends anything outward: a fit is a queued board action on one job.

/** packages/orchestrator/src/crew/queue/requests.ts:144 */
const notLead = 'Evaluate fit needs a job in Leads.';
const noBrief = 'Prepare the job brief first.';
/** `crewShortcut`'s words for a job an agent owns or runs on. */
const busy = 'Wait for this job’s active work to finish.';
/** packages/orchestrator/src/profile-sources/mutation.ts:12 */
const profileHold =
  'Finish the approved profile update on Profile before starting runs or editing notes.';

/** What one call returned; `before` holds the job queue's request ids before an unanswered call. */
export type FitSend =
  | { kind: 'queued' | 'existing'; requestId: string }
  | { kind: 'error'; message: string }
  | { kind: 'unanswered'; before: readonly string[] };

/** A call with no answer whose request the refreshed snapshot does not show. */
const noAnswer = 'No answer from Pitchcrew · check this job’s queue before retrying';

export type FitPlan =
  | { blocker: string }
  | { blocker?: undefined; outcomes: Map<string, BulkOutcome>; send: string[] };

/** Why no selected job can start: the Scout seat's checks, then a Profile update to recover. */
export const workspaceBlocker = (data: Snapshot) =>
  seatBlocker('scout', data) ||
  (data.profileProposals?.some((proposal) => proposal.status === 'applying') ? profileHold : '');

const jobQueue = (data: Snapshot, cardId: string) =>
  data.queue?.queues.find((queue) => queue.id === `job:${cardId}`);

const fitIn = (queue: WorkQueueView | undefined) =>
  queue?.requests.find((request) => request.boardAction === 'fit');

/**
 * Where a job's fit request stands, after "Queued · " or "Already queued · ". A lane paused or
 * asked while one of its runs still executes reports `running` yet starts nothing new, so its pause
 * and its question come before "after the job’s current work".
 */
const fitPlace = (data: Snapshot, items: readonly AttentionItem[], queue: WorkQueueView) => {
  const fit = fitIn(queue);
  if (fit?.deliveries.some((delivery) => delivery.status === 'running'))
    return { text: 'running now', bead: 'plum' as const };
  // Stopped for Retry or Skip, even while another run in the lane still executes.
  if (queue.paused && (queue.pauseKind === 'failed' || queue.pauseKind === 'interrupted')) {
    const stopped = stoppedDelivery(queue);
    if (!fit || stopped?.request.id === fit.id) {
      if (queue.pauseKind === 'interrupted')
        return { text: 'interrupted, waiting for Retry or Skip', bead: 'ochre' as const };
      const finished = stopped?.delivery.runId
        ? data.runs.find((run) => run.id === stopped.delivery.runId)?.finishedAt
        : null;
      const when = finished ? ` ${clockLabel(finished)}` : '';
      return { text: `failed${when}, waiting for Retry or Skip`, bead: 'rose' as const };
    }
  }
  if (queue.state === 'ready') {
    const place = readyLine(data, items).find((entry) => entry.queue.id === queue.id)?.place;
    if (place === 'brief') return { text: 'waits on you · brief', bead: 'ochre' as const };
    // Out of the line: its next request's agent cannot start it, so no free slot ever will.
    const block = headStartBlock(data, queue);
    if (block) return { text: `starts ${block.until}`, bead: 'ochre' as const };
    return typeof place === 'number'
      ? { text: `${ordinal(place)} in line`, bead: 'socket' as const }
      : { text: 'starting', bead: 'socket' as const };
  }
  if (queue.paused && queue.pauseKind === 'user')
    return { text: 'paused by you', bead: 'socket' as const };
  const asked = items.some((item) => item.kind === 'question' && item.queueId === queue.id);
  if (queue.state === 'waiting' || (queue.state === 'running' && asked))
    return { text: 'waiting for your answer', bead: 'ochre' as const };
  // Behind another stopped request: rose when its work failed, as the job's Queue cell shows it.
  if (queue.paused) {
    const bead = queueFailed(queue) ? ('rose' as const) : ('ochre' as const);
    return { text: `on hold: ${queue.reason || 'paused'}`, bead };
  }
  if (queue.state === 'running')
    return { text: 'after the job’s current work', bead: 'plum' as const };
  return { text: `on hold: ${queue.reason || 'paused'}`, bead: 'ochre' as const };
};

const line = (
  data: Snapshot,
  cardId: string,
  kind: BulkOutcome['kind'],
  text: string,
  bead: BulkOutcome['bead'],
): BulkOutcome => ({
  cardId,
  company: data.cards.find((card) => card.id === cardId)?.company ?? 'A deleted job',
  kind,
  text,
  bead,
});

/** A job whose fit already exists: running now, failed, or its place in line. */
const existing = (data: Snapshot, items: readonly AttentionItem[], cardId: string) => {
  const running = data.runs.find(
    (run) => run.cardId === cardId && run.status === 'running' && run.purpose === 'fit',
  );
  if (running)
    return line(
      data,
      cardId,
      'existing',
      `Already queued · ${roleName(data, running.roleId)} is evaluating it now`,
      'plum',
    );
  const queue = jobQueue(data, cardId);
  const place = queue ? fitPlace(data, items, queue) : { text: 'in its job queue', bead: null };
  return line(data, cardId, 'existing', `Already queued · ${place.text}`, place.bead);
};

/** A job this batch queued, with its place now. */
const queued = (data: Snapshot, items: readonly AttentionItem[], cardId: string) => {
  const queue = jobQueue(data, cardId);
  const place = queue ? fitPlace(data, items, queue) : { text: 'in its job queue', bead: null };
  return line(data, cardId, 'queued', `Queued · ${place.text}`, place.bead ?? 'socket');
};

/**
 * A call that got no answer, told from the refreshed snapshot as an answer would have told it: a
 * fit request in the job's queue that was not there before the call means it was queued, one that
 * was means already queued. With no such request (a failed refresh, or a fit that already ran) it
 * stays unconfirmed, in ochre: the user checks the job's queue before retrying.
 */
const unanswered = (
  data: Snapshot,
  items: readonly AttentionItem[],
  cardId: string,
  before: readonly string[],
) => {
  const fit = fitIn(jobQueue(data, cardId));
  if (!fit) return line(data, cardId, 'unconfirmed', noAnswer, 'ochre');
  return before.includes(fit.id) ? existing(data, items, cardId) : queued(data, items, cardId);
};

/**
 * The preflight, in selection order: a workspace blocker stops everything; otherwise each job is
 * not a lead (not sent), already queued (a fit running or in its queue), not sent (no brief, or
 * other work running on it or an agent owning it), or sent. A fit that already exists is reported
 * as it stands before any missing brief: sending would only return it, and the Queue column shows
 * it running or in line.
 */
export const planFits = (
  data: Snapshot,
  items: readonly AttentionItem[],
  cardIds: readonly string[],
): FitPlan => {
  const blocker = workspaceBlocker(data);
  if (blocker) return { blocker };
  const outcomes = new Map<string, BulkOutcome>();
  const send: string[] = [];
  const unsent = (cardId: string, reason: string) =>
    outcomes.set(cardId, line(data, cardId, 'unsent', `Not sent · ${reason}`, null));
  for (const cardId of cardIds) {
    const card = data.cards.find((entry) => entry.id === cardId);
    if (!card) continue;
    const runs = data.runs.filter((run) => run.cardId === cardId && run.status === 'running');
    if (card.state !== 'lead') unsent(cardId, notLead);
    else if (runs.some((run) => run.purpose === 'fit') || fitIn(jobQueue(data, cardId)))
      outcomes.set(cardId, existing(data, items, cardId));
    else if (!card.applicationContext) unsent(cardId, noBrief);
    else if (runs.length || card.owner) unsent(cardId, busy);
    else send.push(cardId);
  }
  return { outcomes, send };
};

/**
 * Every job's outcome in table order, read from the snapshot after the batch: a job not sent keeps
 * its preflight reason; a sent job is queued (its place now) or already queued (the server returned
 * a request that was in its queue before the call); a call the daemon refused is not sent with its
 * error; a call that got no answer is reconciled with the snapshot, or left unconfirmed.
 */
export const fitOutcomes = (
  data: Snapshot,
  items: readonly AttentionItem[],
  plan: Exclude<FitPlan, { blocker: string }>,
  sent: ReadonlyMap<string, FitSend>,
  order: readonly string[],
): BulkOutcome[] => {
  const chosen = new Set([...plan.outcomes.keys(), ...sent.keys()]);
  const ordered = [
    ...order.filter((id) => chosen.has(id)),
    ...[...chosen].filter((id) => !order.includes(id)),
  ];
  return ordered.map((cardId) => {
    const result = sent.get(cardId);
    const planned = plan.outcomes.get(cardId);
    if (!result) return planned?.kind === 'existing' ? existing(data, items, cardId) : planned!;
    if (result.kind === 'error')
      return line(data, cardId, 'unsent', `Not sent · ${result.message}`, null);
    if (result.kind === 'unanswered') return unanswered(data, items, cardId, result.before);
    if (result.kind === 'existing') return existing(data, items, cardId);
    return queued(data, items, cardId);
  });
};

/** Jobs a batch queued or found queued; they leave the selection, and the rest stay selected. */
export const isSettled = (outcome: BulkOutcome) =>
  outcome.kind === 'queued' || outcome.kind === 'existing';

/** Jobs that leave the selection after a batch: queued or already queued. */
export const settledIds = (outcomes: readonly BulkOutcome[]) =>
  new Set(outcomes.filter(isSettled).map((outcome) => outcome.cardId));

/**
 * The batch's counts, one part each, read as "16 jobs · 10 queued · 3 already queued · 3 not sent",
 * then "· 1 unconfirmed" only when a call got no answer and the snapshot could not settle it.
 */
export const outcomeParts = (outcomes: readonly BulkOutcome[]) => {
  const count = (kind: BulkOutcome['kind']) =>
    outcomes.filter((outcome) => outcome.kind === kind).length;
  const unconfirmed = count('unconfirmed');
  return [
    `${outcomes.length} ${outcomes.length === 1 ? 'job' : 'jobs'}`,
    `${count('queued')} queued`,
    `${count('existing')} already queued`,
    `${count('unsent')} not sent`,
    ...(unconfirmed ? [`${unconfirmed} unconfirmed`] : []),
  ];
};
