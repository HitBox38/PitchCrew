import type { Snapshot } from '@pitchcrew/core';
import { isFinalSubmission } from '@/ComputerApprovals/helpers.ts';
import type { AttentionItem, AttentionKind } from '@/lib/attention.ts';
import { attentionAsk, attentionSubject, boardActionNouns } from '@/lib/attention-labels.ts';
import { positiveStates, stateLabels } from '@/lib/labels.ts';
import { roleName } from '@/lib/run-labels.ts';
import { lineWords, readyLine } from '@/lib/ready-line.ts';
import { wordCut } from '@/lib/text.ts';
import { executingRuns } from '@/lib/work-queue.ts';
import type { DeskCall, DeskView, RecordTone } from './types.ts';

// What a desk decision did, as its record line says it: read from the saved result in the fresh
// snapshot where there is one, else from the calls the embedded component sent.

type Outcome = { text: string; bead: RecordTone };
type Context = {
  view: DeskView;
  /** The calls the daemon accepted. */
  calls: readonly DeskCall[];
  /** Later calls it refused (a Skip's queue resume): what they did not do. */
  failed: readonly DeskCall[];
  fresh: Snapshot;
  items: readonly AttentionItem[];
};
type Words = (context: Context) => string | Outcome;

const bodyOf = (call: DeskCall | undefined) => (call?.body ?? {}) as Record<string, unknown>;
/** A call's path in segments: `['user-input', '<id>', 'answer']`. Home never spells a route. */
const segments = (call: DeskCall) => call.path.split('/').filter(Boolean);
const verb = (call: DeskCall) => segments(call).at(-1);
const lastCall = (calls: readonly DeskCall[], test: (call: DeskCall) => boolean) =>
  calls.findLast(test);
const agentOf = ({ view }: Context) => roleName(view.data, view.item.roleId);

/** A queue's place after a decision: running now, starting, or its place in the waiting line. */
const placeOf = ({ view, fresh, items }: Context) => {
  const queue = fresh.queue?.queues.find((entry) => entry.id === view.item.queueId);
  if (!queue) return null;
  if (queue.state === 'running') return 'running';
  return readyLine(fresh, items).find((entry) => entry.queue.id === queue.id)?.place ?? null;
};

const browser: Words = (context) => {
  const { view, fresh, calls } = context;
  const saved = fresh.computerApprovals.find((entry) => entry.id === view.item.entityId)?.status;
  const sent = bodyOf(lastCall(calls, (call) => verb(call) === 'decide')).approved;
  const agent = agentOf(context);
  if (saved === 'rejected' || (saved !== 'approved' && saved !== 'consumed' && sent === false))
    return `Rejected: nothing was done. ${agent}’s run may ask again or end.`;
  const approval = view.data.computerApprovals.find((entry) => entry.id === view.item.entityId);
  const submission = !!approval && isFinalSubmission(approval.action);
  const summary = attentionAsk(view.item, view.data);
  return submission
    ? `Approved: ${summary}. ${agent} carries it out; you verify the outcome after.`
    : `Approved: ${summary}. ${agent} carries it out.`;
};

/**
 * What became of the answered question's own continuation, from its saved request and delivery:
 * the agent works on it now, waits on another question or hold in its queue, waits for the run
 * that holds the queue, or waits for a slot. Never the queue's state alone: a queue reads running
 * while another run in it works and this continuation waits.
 */
const continuation = ({ view, fresh, items }: Context) => {
  const id = fresh.userInputs?.find(
    (entry) => entry.id === view.item.entityId,
  )?.continuationRequestId;
  if (!id) return '';
  const queue = fresh.queue?.queues.find((entry) => entry.requests.some((r) => r.id === id));
  const request =
    queue?.requests.find((entry) => entry.id === id) ??
    fresh.chatRequests?.find((entry) => entry.id === id);
  const delivery = request?.deliveries[0];
  if (!delivery) return '';
  const agent = roleName(fresh, delivery.roleId);
  if (delivery.status === 'running') return ` · ${agent} continues now`;
  if (delivery.status !== 'queued' || !queue) return '';
  // The server starts nothing in a queue while any question in it waits.
  const other = items.find((item) => item.kind === 'question' && item.queueId === queue.id);
  if (other) {
    const whose =
      other.roleId === delivery.roleId ? 'its other' : `${roleName(fresh, other.roleId)}’s`;
    return ` · ${agent} continues after you answer ${whose} question`;
  }
  if (queue.paused || queue.state === 'blocked') return ` · ${agent}’s continuation is on hold`;
  if (queue.state === 'running') {
    const runner = executingRuns(queue.runs)[0];
    return ` · ${agent} continues when ${runner ? `${roleName(fresh, runner.roleId)}’s run` : 'the current work'} ends`;
  }
  const place = readyLine(fresh, items).find((entry) => entry.queue.id === queue.id)?.place;
  if (place === 'starting') return ` · ${agent} continues now`;
  return typeof place === 'number'
    ? ` · ${agent} continues when a slot frees, ${lineWords(place)}`
    : '';
};

const question: Words = (context) => {
  const call = lastCall(context.calls, (entry) => segments(entry)[0] === 'user-input');
  if (call && verb(call) === 'cancel') return 'Question cancelled';
  const body = bodyOf(call);
  const asked = context.view.data.userInputs?.find(
    (entry) => entry.id === context.view.item.entityId,
  );
  const chosen = (Array.isArray(body.selected) ? (body.selected as string[]) : []).map(
    (id) => asked?.options.find((option) => option.id === id)?.label ?? id,
  );
  const answer = wordCut(chosen.length ? chosen.join(', ') : String(body.text ?? ''), 60);
  return `Answered “${answer}”${continuation(context)}`;
};

/** The work a removed request stood for, read from the snapshot that still holds it. */
const skippedWork = (data: Snapshot, id: string | undefined) => {
  const request =
    data.queue?.queues.flatMap((queue) => queue.requests).find((entry) => entry.id === id) ??
    data.chatRequests?.find((entry) => entry.id === id);
  return request?.boardAction ? boardActionNouns[request.boardAction] : 'request';
};

/** Where a resumed queue or a retried request stands now. */
const placeWords = (place: ReturnType<typeof placeOf>) =>
  place === 'running'
    ? 'running now'
    : place === 'starting'
      ? 'starting now'
      : typeof place === 'number'
        ? lineWords(place)
        : '';

const failure: Words = (context) => {
  const { calls, failed, view } = context;
  const action = (call: DeskCall) => bodyOf(call).action;
  const resumes = (call: DeskCall) => segments(call)[0] === 'queue' && action(call) === 'resume';
  const lane = view.item.cardId ? 'the job’s queue' : 'the queue';
  const removed = calls.find((call) => action(call) === 'remove');
  if (removed) {
    const skipped = `Skipped the ${skippedWork(view.data, segments(removed)[1])}`;
    // Only what completed: the queue continues once its resume succeeded, never before.
    if (calls.some(resumes)) return `${skipped} · ${lane} continues`;
    return failed.some(resumes) ? `${skipped} · ${lane} is still paused` : skipped;
  }
  const last = calls.at(-1);
  if (last && action(last) === 'retry-follow-up') return 'Follow-up retry queued';
  if (last && action(last) === 'skip-follow-up') return 'Follow-up skipped · the queue continues';
  const where = placeWords(placeOf(context));
  if (last && resumes(last)) return where ? `Resumed ${lane} · ${where}` : `Resumed ${lane}`;
  if (where === 'running now') return 'Retry running now';
  return where ? `Retry queued · ${where}` : 'Retry queued';
};

const tracking: Words = ({ view, fresh, calls }) => {
  const signal =
    fresh.trackingSignals?.find((entry) => entry.id === view.item.entityId) ??
    view.data.trackingSignals?.find((entry) => entry.id === view.item.entityId);
  const sent = bodyOf(lastCall(calls, (call) => verb(call) === 'decision')).approved;
  const applied = signal?.status === 'applied' || (signal?.status !== 'rejected' && sent === true);
  if (applied && signal)
    return {
      text: `Recorded ${stateLabels[signal.state]}`,
      bead: positiveStates.has(signal.state) ? 'moss' : 'primary',
    };
  const cardId = signal?.cardId ?? view.item.cardId;
  const card = fresh.cards.find((entry) => entry.id === cardId);
  return card
    ? `Update rejected · ${card.company} stays ${stateLabels[card.state]}`
    : 'Update rejected';
};

const packet: Words = (context) => {
  const { view, fresh, calls } = context;
  const company = attentionSubject(view.item, view.data);
  const completed = bodyOf(lastCall(calls, (call) => verb(call) === 'complete')).state;
  if (completed === 'withdrawn') return `Marked withdrawn · nothing is sent to ${company}`;
  if (completed === 'submitted') return 'Recorded Submitted';
  const submit = bodyOf(lastCall(calls, (call) => verb(call) === 'submit'));
  if (submit.method === 'agent')
    return `Handed to ${roleName(fresh, String(submit.roleId ?? ''))} to prepare · nothing is submitted until you approve the final step`;
  const saved = fresh.approvals.find((entry) => entry.id === view.item.entityId)?.status;
  return saved === 'rejected' ? 'Packet rejected · nothing is exported' : 'Decided';
};

/** A proposal's saved status, else the decision the footer sent. */
const decided = (status: string | undefined, calls: readonly DeskCall[]) => {
  if (status === 'applied' || status === 'approved') return true;
  if (status === 'rejected') return false;
  const sent = calls.at(-1);
  const body = bodyOf(sent);
  return body.approved === true;
};

const roleProposal: Words = ({ view, fresh, calls }) => {
  const target = roleName(view.data, view.item.targetId);
  const status = fresh.proposals.find((entry) => entry.id === view.item.entityId)?.status;
  return decided(status, calls)
    ? `Applied · ${target} uses it from its next run`
    : `Declined · ${target}’s instructions stay as they are`;
};

const skillProposal: Words = ({ view, fresh, calls }) =>
  decided(fresh.skillProposals.find((entry) => entry.id === view.item.entityId)?.status, calls)
    ? 'Skill added · available in new runs'
    : 'Declined';

const writing: Words = ({ view, fresh, calls }) => {
  const proposal = fresh.quality?.writingGuide.proposals.find(
    (entry) => entry.id === view.item.entityId,
  );
  return decided(proposal?.status, calls) ? 'Applied to the writing guide' : 'Dismissed';
};

/** Kinds decided in place; the others open a form or page, so the desk never records them. */
const outcomes: Partial<Record<AttentionKind, Words>> = {
  browser,
  question,
  failure,
  tracking,
  packet,
  'role-proposal': roleProposal,
  'skill-proposal': skillProposal,
  'writing-suggestion': writing,
  // Confirmed in job details opened from the row; the record keeps the footer's promise.
  brief: () => 'Brief confirmed · Writer and Reviewer see only what you confirmed',
};

/** A record line's words and bead for the calls a desk decision sent. */
export const deskOutcome = (
  view: DeskView,
  calls: readonly DeskCall[],
  fresh: Snapshot,
  items: readonly AttentionItem[],
): Outcome => {
  const context: Context = {
    view,
    calls: calls.filter((call) => !call.failed),
    failed: calls.filter((call) => call.failed),
    fresh,
    items,
  };
  const words = outcomes[view.item.kind]?.(context) ?? 'Decided';
  return typeof words === 'string' ? { text: words, bead: 'primary' } : words;
};
