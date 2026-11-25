import type { Card, Snapshot } from '@pitchcrew/core';
import { runtimeTimeLimit } from '@pitchcrew/core/run-limits';
import { workflowSeat } from '@pitchcrew/core/states';
import {
  failedFollowUp,
  stoppedDelivery,
  type AttentionItem,
  type AttentionKind,
} from '@/lib/attention.ts';
import {
  attentionAsk,
  attentionSubject,
  boardActionNouns,
  pageHost,
} from '@/lib/attention-labels.ts';
import { stateLabels } from '@/lib/labels.ts';
import { roleName } from '@/lib/run-labels.ts';
import { clockLabel } from '@/lib/time.ts';
import { executingRuns } from '@/lib/work-queue.ts';
import { proposalNotice } from '@/components/ProfileView/helpers.ts';

/**
 * The open row's own words: what is asked, then who asked and when, beside the pebble of `by`, the
 * agent that acted (the asking agent unless a kind names another; null for none).
 */
export type OpenWords = { headline: string; provenance: string; by?: string | null };
type Words = (item: AttentionItem, data: Snapshot) => OpenWords;

const at = (iso: string | null | undefined) => (iso ? clockLabel(iso) : '');
const asked = (item: AttentionItem, data: Snapshot, verb = 'asked') => {
  const clock = at(item.askedAt);
  return `${roleName(data, item.roleId)} ${verb}${clock ? ` at ${clock}` : ''}`;
};
/** The captured address without its scheme, as the browser panel shows a page. */
export const capturedAddress = (url: string) => url.replace(/^https?:\/\//, '');

/** The uncertain submission attempt a verify item stands for. */
export const attemptOf = (item: AttentionItem, data: Snapshot) =>
  data.cards
    .find((card) => card.id === item.cardId)
    ?.submissionAttempts?.find((attempt) => attempt.id === item.entityId);

const profileWords: Words = (item, data) => {
  const proposal = data.profileProposals?.find((entry) => entry.id === item.entityId);
  return {
    headline: attentionAsk(item, data),
    provenance: proposal ? proposalNotice(proposal).detail : '',
  };
};

/** Who reviewed a packet: its review run's agent, else the agent in the Reviewer seat. */
const reviewer = (data: Snapshot, card: Card | undefined) =>
  data.runs.find((run) => run.id === card?.packetReview?.runId)?.roleId ??
  data.roles.find((role) => !role.retiredAt && workflowSeat(role) === 'reviewer')?.id ??
  null;

/** The agent whose extraction saved a brief, when that run is known: the brief follows it. */
const extractor = (data: Snapshot, card: Card | undefined) => {
  const saved = Date.parse(card?.applicationContext?.createdAt ?? '');
  return (
    data.runs.find((run) => {
      if (run.cardId !== card?.id || run.purpose !== 'source-extraction') return false;
      const after = saved - Date.parse(run.finishedAt ?? '');
      return run.status === 'completed' && after >= 0 && after < 5_000;
    })?.roleId ?? null
  );
};

const packetWords: Words = (item, data) => {
  const approval = data.approvals.find((entry) => entry.id === item.entityId);
  const card = data.cards.find((entry) => entry.id === item.cardId);
  const stage = item.stage ?? 'approve';
  const agreed = stage === 'approve' ? reviewer(data, card) : null;
  const reviewed = at(card?.packetReview?.reviewedAt ?? approval?.createdAt);
  const lines = {
    approve: `${agreed ? roleName(data, agreed) : 'Reviewer'} agreed at ${reviewed}`,
    choose: `You approved the packet at ${at(approval?.decidedAt)}`,
    apply: `Files saved at ${at(approval?.decidedAt)}. Nothing has been sent.`,
    preparing: `${roleName(data, item.roleId)}’s preparation stopped`,
    verify: '',
  };
  return {
    headline: attentionAsk(item, data),
    provenance: lines[stage],
    by: stage === 'approve' ? agreed : item.roleId,
  };
};

// The daemon's fixed words for work a restart or a stop interrupted
// (packages/orchestrator/src/crew/lifecycle.ts:173, :196, :217 and :293), which an interrupted
// row's headline, "… was interrupted when Pitchcrew stopped", already says.
const interruptions = new Set([
  'The daemon stopped. Retry or skip this follow-up.',
  'Interrupted by daemon restart. Retry or skip this follow-up.',
  'Interrupted by daemon restart. Retry or skip this request.',
  'Interrupted when the daemon stopped. Retry or skip this request.',
]);
/** The daemon's retry advice, which a stopped row's verbs already give. */
const retryAdvice = /^Retry or skip this (request|follow-up)\.$/;
const interrupted = ' was interrupted when Pitchcrew stopped';
const stopEnds = [' stopped before finishing', interrupted];
const sentences = (text: string) => text.trim().split(/(?<=\.)\s+/);
const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/**
 * Whether a failure's reason only says what its headline says: the stop itself, with or without
 * who or what stopped ("Scout stopped before finishing." under "Scout’s fit evaluation stopped
 * before finishing"), then at most the retry advice the verbs give; or, under an interrupted
 * headline, the daemon's own words for the restart. A reason with any other fact stays.
 */
export const restatesHeadline = (reason: string, headline: string, agent: string) => {
  if (interruptions.has(reason)) return headline.endsWith(interrupted);
  const end = stopEnds.find((stop) => headline.endsWith(stop));
  const [first = '', ...rest] = sentences(reason);
  if (!end || !rest.every((sentence) => retryAdvice.test(sentence))) return false;
  const lower = first.toLowerCase();
  const who = [headline.slice(0, -end.length), agent].find(
    (subject) => subject && lower.startsWith(`${subject.toLowerCase()} `),
  );
  const said = new Set(words(end));
  return words(who ? first.slice(who.length) : first).every((word) => said.has(word));
};

/** A saved pause reason as what happened, without advice for work that is gone. */
const history = (reason: string) =>
  sentences(reason)
    .filter((sentence) => !retryAdvice.test(sentence))
    .join(' ') || reason;

const openWords: Record<AttentionKind, Words> = {
  browser: (item, data) => ({
    headline: attentionAsk(item, data),
    provenance: asked(item, data),
  }),
  connection: (item, data) => ({
    headline: attentionAsk(item, data),
    provenance: `App-provided name. Review only a connection you started and match its code in Settings.${item.expiresAt ? ` Expires at ${at(item.expiresAt)}.` : ''}`,
  }),
  'profile-recovery': profileWords,
  // The question itself is the headline; the shared form's own title gives way to it on Home.
  question: (item, data) => {
    const conversation = data.conversations?.find((entry) => entry.id === item.threadId)?.title;
    return {
      headline: attentionAsk(item, data),
      provenance: `${asked(item, data)}${conversation ? ` in ${conversation}` : ''}`,
    };
  },
  failure: (item, data) => {
    const agent = item.roleId ? roleName(data, item.roleId) : '';
    const reason = item.reason ?? '';
    const headline = attentionAsk(item, data);
    const queue = data.queue?.queues.find((entry) => entry.id === item.queueId);
    // Nothing stopped is left, yet the queue stays paused: its saved reason is what paused it.
    if (queue && !stoppedDelivery(queue) && !failedFollowUp(queue))
      return { headline, provenance: reason ? `Paused when: ${history(reason)}` : '' };
    // A reason that restates the headline gives way to its agent; one that names it says it once.
    if (restatesHeadline(reason, headline, agent)) return { headline, provenance: agent };
    return {
      headline,
      provenance:
        agent && reason.startsWith(agent) ? reason : [agent, reason].filter(Boolean).join(' · '),
    };
  },
  verify: (item, data) => {
    const attempt = attemptOf(item, data);
    const where = pageHost(attempt?.before.url);
    return {
      headline: attentionAsk(item, data),
      provenance: `${asked(item, data, 'submitted')}${where ? ` · ${where}` : ''}`,
    };
  },
  blocked: (item, data) => {
    const queue = data.queue?.queues.find((entry) => entry.id === item.queueId);
    const action = queue?.requests[0]?.boardAction;
    const what = action ? boardActionNouns[action] : 'request';
    return {
      headline: item.reason || attentionAsk(item, data),
      provenance: item.roleId ? `${roleName(data, item.roleId)}’s ${what} is on hold` : '',
    };
  },
  packet: packetWords,
  brief: (item, data) => {
    const card = data.cards.find((entry) => entry.id === item.cardId);
    const extracted = at(card?.applicationContext?.createdAt);
    const by = extractor(data, card);
    return {
      headline: `Confirm the ${attentionSubject(item, data)} brief`,
      provenance: !extracted
        ? ''
        : by
          ? `${roleName(data, by)} extracted it at ${extracted}`
          : `Extracted at ${extracted}`,
      by,
    };
  },
  export: (item, data) => {
    const card = data.cards.find((entry) => entry.id === item.cardId);
    const reviewed = at(card?.packetReview?.reviewedAt);
    return {
      headline: attentionAsk(item, data),
      provenance: reviewed ? `Reviewed at ${reviewed}` : '',
      by: item.roleId ?? reviewer(data, card),
    };
  },
  tracking: (item, data) => {
    const signal = data.trackingSignals?.find((entry) => entry.id === item.entityId);
    return {
      headline: signal
        ? `${signal.company} · ${signal.title} → ${stateLabels[signal.state]}`
        : attentionAsk(item, data),
      provenance: asked(item, data, 'matched this email'),
    };
  },
  'role-proposal': (item, data) => ({
    headline: attentionAsk(item, data),
    provenance: `Proposed by ${roleName(data, item.roleId)}${item.askedAt ? ` at ${at(item.askedAt)}` : ''}`,
  }),
  'skill-proposal': (item, data) => ({
    headline: attentionAsk(item, data),
    provenance: `Proposed by ${roleName(data, item.roleId)}${item.askedAt ? ` at ${at(item.askedAt)}` : ''}`,
  }),
  'instruction-update': (item, data) => {
    const update = data.instructionUpdates?.find((entry) => entry.roleId === item.targetId);
    const newest = update?.changes.reduce<(typeof update.changes)[number] | undefined>(
      (best, change) => (!best || change.date > best.date ? change : best),
      undefined,
    );
    return { headline: attentionAsk(item, data), provenance: newest?.summary ?? '' };
  },
  'skill-update': (item, data) => ({ headline: attentionAsk(item, data), provenance: '' }),
  // The suggestion's card names who proposed it.
  'writing-suggestion': () => ({ headline: 'Writing suggestion', provenance: '' }),
  'profile-proposal': profileWords,
};

/** The open row's headline and provenance for any kind. */
export const openRowWords = (item: AttentionItem, data: Snapshot) =>
  openWords[item.kind](item, data);

/**
 * What stays stuck while the item waits, from its `blocks`: a run and its slot (with the run's end,
 * an estimate, so "about"), every agent launch, a queue, or the job's browser actions.
 */
export const waitingOn = (item: AttentionItem, data: Snapshot) => {
  const subject = attentionSubject(item, data);
  if (item.blocks === 'run') {
    const run = data.runs.find(
      (entry) =>
        entry.status === 'running' &&
        data.computerApprovals.some(
          (approval) => approval.id === item.entityId && approval.runId === entry.id,
        ),
    );
    return {
      text: `${roleName(data, item.roleId)}’s run and one work slot. The request ends with the run${item.expiresAt ? '' : '.'}`,
      ends: item.expiresAt
        ? {
            iso: item.expiresAt,
            clock: at(item.expiresAt),
            why: `Runs stop ${runtimeTimeLimit / 60_000} minutes after they start${run ? `; this run started at ${at(run.startedAt)}` : ''}.`,
          }
        : null,
    };
  }
  if (item.blocks === 'crew')
    return {
      text: 'Every agent launch in this workspace, until the update is retried.',
      ends: null,
    };
  if (item.blocks === 'queue') {
    // Crew's lens draws the same line: the slot is released unless other work in the queue runs.
    const queue = data.queue?.queues.find((entry) => entry.id === item.queueId);
    if (queue?.state !== 'running')
      return { text: `${subject}’s queue; its slot is released.`, ends: null };
    const runner = executingRuns(queue.runs)[0];
    const holder = runner ? `${roleName(data, runner.roleId)}’s run` : 'other work';
    return { text: `${subject}’s queue; ${holder} still holds its slot.`, ends: null };
  }
  if (item.blocks === 'browser')
    return {
      text: `Every browser action on ${subject}, until you record the outcome.`,
      ends: null,
    };
  return null;
};
