import type {
  BoardAction,
  ChatRequest,
  ComputerApproval,
  Snapshot,
  WorkQueueView,
} from '@pitchcrew/core';
import { roleProposalSummary, skillProposalSummary } from '@/ChatWork/summary.ts';
import { packetTitle, verifyTitle } from '@/ClayInterface/packet-guidance.ts';
import { approvalSummary } from '@/ComputerApprovals/helpers.ts';
import { proposalNotice } from '@/components/ProfileView/helpers.ts';
import {
  failedFollowUp,
  stoppedDelivery,
  type AttentionItem,
  type AttentionKind,
} from './attention.ts';
import { snapshotStepFacts } from './job-step.ts';
import { stateLabels } from './labels.ts';
import type { PacketStage } from './packet-stage.ts';
import { requestLabel, roleName } from './run-labels.ts';
import { wordCut } from './text.ts';

// Shared words for attention items, so Home, the Pipeline table's Queue cell and the Crew lens
// never word the same item two ways. Every function takes the item and the snapshot it came from.

type Words = (item: AttentionItem, data: Snapshot) => string;

const cardOf = (item: AttentionItem, data: Snapshot) =>
  item.cardId ? data.cards.find((card) => card.id === item.cardId) : undefined;
const signalOf = (item: AttentionItem, data: Snapshot) =>
  data.trackingSignals?.find((signal) => signal.id === item.entityId);
const profileProposalOf = (item: AttentionItem, data: Snapshot) =>
  data.profileProposals?.find((proposal) => proposal.id === item.entityId);
const queueOf = (item: AttentionItem, data: Snapshot) =>
  data.queue?.queues.find((queue) => queue.id === item.queueId);

const skillName = (item: AttentionItem, data: Snapshot) =>
  data.skills.find((skill) => skill.id === item.targetId)?.name ?? 'A skill';

/** What a change kind is about, before any conversation: an agent's own chat shares its id. */
const ownSubjects: Partial<Record<AttentionKind, Words>> = {
  'role-proposal': (item, data) => `${roleName(data, item.targetId)}’s instructions`,
  'instruction-update': (item, data) => `${roleName(data, item.targetId)}’s instructions`,
  'skill-proposal': (item) => item.targetId ?? 'A skill',
  'skill-update': skillName,
  'writing-suggestion': () => 'Writing guide',
  'profile-proposal': () => 'Profile',
  'profile-recovery': () => 'Profile',
  // The app names itself; quoted, as its ask quotes it, so the name is never taken as ours.
  connection: (item) => (item.name ? `“${item.name}”` : 'A remote app'),
  // An uncertain match with several candidates names the company from the email.
  tracking: (item, data) => signalOf(item, data)?.company ?? '',
};

/** The row's subject: the job's company, the change's subject, else the conversation or queue. */
export const attentionSubject: Words = (item, data) => {
  const card = cardOf(item, data);
  if (card) return card.company;
  const own = ownSubjects[item.kind]?.(item, data);
  if (own) return own;
  const conversation = item.threadId
    ? data.conversations?.find((entry) => entry.id === item.threadId)
    : undefined;
  if (conversation) return conversation.title;
  const queue = item.queueId ? queueOf(item, data) : undefined;
  return queue?.title ?? 'Chat';
};

const packetKinds: Record<PacketStage, string> = {
  approve: 'Packet to approve',
  choose: 'Choose how to apply',
  apply: 'Ready to apply',
  preparing: 'Preparation stopped',
  verify: 'Submission to verify',
};

const kindLabels: Record<AttentionKind, Words> = {
  browser: () => 'Browser action approval',
  connection: () => 'Connection request',
  'profile-recovery': () => 'Profile update needs recovery',
  question: (item, data) => `Question from ${roleName(data, item.roleId)}`,
  failure: (item) => (item.tone === 'rose' ? 'Failed request' : 'Interrupted request'),
  verify: () => 'Submission to verify',
  blocked: () => 'On hold',
  packet: (item) => packetKinds[item.stage ?? 'approve'],
  brief: () => 'Job brief to confirm',
  export: () => 'Reviewed packet to export',
  tracking: () => 'Tracking review',
  'role-proposal': (item, data) => `Proposal from ${roleName(data, item.roleId)}`,
  'skill-proposal': (item, data) => `Skill suggestion from ${roleName(data, item.roleId)}`,
  'instruction-update': () => 'New default instructions',
  'skill-update': () => 'Skill update',
  'writing-suggestion': (item, data) => `Writing suggestion from ${roleName(data, item.roleId)}`,
  'profile-proposal': () => 'Profile update to review',
};

/** The kind of ask, under the subject on a closed row: "Question from Writer". */
export const attentionKindLabel: Words = (item, data) => kindLabels[item.kind](item, data);

/** A page's host name, "jobs.example.com"; empty for a missing or unreadable address. */
export const pageHost = (url: string | null | undefined) => {
  try {
    return url ? new URL(url).hostname : '';
  } catch {
    return '';
  }
};

/** A board action as a noun, after an agent or "the": "Writer’s draft", "Skipped the review". */
export const boardActionNouns: Record<BoardAction, string> = {
  fit: 'fit evaluation',
  reevaluate: 'packet reevaluation',
  draft: 'draft',
  review: 'review',
  'deep-review': 'deep review',
};

/** The exact action, plus the page's host unless the summary already names it or opens a page. */
const browserAsk = (approval: ComputerApproval) => {
  const summary = approvalSummary(approval.action, approval.page);
  const host = pageHost(approval.page.url);
  return !host || approval.action.kind === 'navigate' || summary.includes(host)
    ? summary
    : `${summary} on ${host}`;
};

/** A request as the work its agent did, after the agent's name: "fit evaluation", "reply to “…”". */
const requestWork = (request: ChatRequest, data: Snapshot) => {
  if (request.boardAction) return boardActionNouns[request.boardAction];
  if (request.userInputId) return 'continuation after your answer';
  if (request.summarize) return 'summary';
  const routine = request.routine
    ? data.routines.find((entry) => entry.id === request.routine?.routineId)
    : undefined;
  if (routine) return routine.name;
  return request.content.trim() ? `reply to “${requestLabel(request, data)}”` : 'reply';
};

/**
 * What stopped, as a noun after its agent: the stopped request's work, else the failed crew
 * follow-up. Undefined once neither is left (skipped or removed) while the queue stays paused.
 */
const failureWork = (queue: WorkQueueView, data: Snapshot) => {
  const stopped = stoppedDelivery(queue);
  const task = stopped ? undefined : failedFollowUp(queue);
  if (task) {
    const parent = data.runs.find((run) => run.id === task.parentRunId);
    return `follow-up for ${roleName(data, parent?.roleId)}`;
  }
  return stopped ? requestWork(stopped.request, data) : undefined;
};

/** "Scout’s fit evaluation stopped before finishing", as a possessive noun phrase. */
const failureAsk: Words = (item, data) => {
  const queue = queueOf(item, data);
  const work = queue ? failureWork(queue, data) : undefined;
  if (!work) return 'Paused until you resume the queue';
  const what = item.roleId ? `${roleName(data, item.roleId)}’s ${work}` : `The ${work}`;
  return item.tone === 'rose'
    ? `${what} stopped before finishing`
    : `${what} was interrupted when Pitchcrew stopped`;
};

/**
 * The job dock's words for the step the brief is on, repeated from `lines` in
 * `components/CardDetails/dock.ts`: change both together until they share one home here.
 */
const briefAsk: Words = (item, data) => {
  const card = cardOf(item, data);
  const facts = card ? snapshotStepFacts(card, data.approvals) : undefined;
  if (facts?.formMissing) return 'Check the application form first';
  if (!facts || !facts.briefConfirmed) return 'Check the brief before drafting';
  return 'Add your answers to the brief';
};

const trackingAsk: Words = (item, data) => {
  const signal = signalOf(item, data);
  if (!signal) return 'An application update to review';
  return `${signal.title} → ${stateLabels[signal.state]}${signal.cardId ? '' : ' · uncertain match'}`;
};

const roleAsk: Words = (item, data) => {
  const proposal = data.proposals.find((entry) => entry.id === item.entityId);
  const before = proposal?.beforeRole ?? data.roles.find((role) => role.id === item.targetId);
  return proposal && before
    ? roleProposalSummary(proposal, before)
    : 'Proposes a change to its instructions';
};

const profileAsk: Words = (item, data) => {
  const proposal = profileProposalOf(item, data);
  return proposal ? proposalNotice(proposal).title : 'A Profile update to review';
};

const asks: Record<AttentionKind, Words> = {
  browser: (item, data) => {
    const approval = data.computerApprovals.find((entry) => entry.id === item.entityId);
    return approval ? browserAsk(approval) : 'Approve a browser action';
  },
  connection: (item) => `“${item.name ?? 'An app'}” wants to connect`,
  'profile-recovery': profileAsk,
  question: (item, data) =>
    data.userInputs?.find((input) => input.id === item.entityId)?.question ?? 'A question for you',
  failure: failureAsk,
  verify: (item, data) => verifyTitle(cardOf(item, data)),
  blocked: (item) => item.reason || 'On hold',
  packet: (item, data) => {
    const approval = data.approvals.find((entry) => entry.id === item.entityId);
    return approval ? packetTitle(approval, cardOf(item, data)) : 'A packet to review';
  },
  brief: briefAsk,
  export: (item, data) =>
    `${item.roleId ? roleName(data, item.roleId) : 'Reviewer'} agreed. Choose formats and request export approval`,
  tracking: trackingAsk,
  'role-proposal': roleAsk,
  'skill-proposal': (item, data) => {
    const proposal = data.skillProposals.find((entry) => entry.id === item.entityId);
    return proposal
      ? skillProposalSummary(proposal, (id) => roleName(data, id))
      : 'Suggests a skill';
  },
  'instruction-update': (item, data) =>
    `${roleName(data, item.targetId)} has new default instructions`,
  'skill-update': (item, data) => `${skillName(item, data)} has an upstream update`,
  'writing-suggestion': (item, data) => {
    const proposal = data.quality?.writingGuide.proposals.find(
      (entry) => entry.id === item.entityId,
    );
    return wordCut(proposal?.text ?? '', 120) || 'A writing guide suggestion';
  },
  'profile-proposal': profileAsk,
};

/** The one-sentence ask on a closed row. */
export const attentionAsk: Words = (item, data) => asks[item.kind](item, data);

const packetPhrases: Record<PacketStage, string> = {
  approve: 'approve the packet',
  choose: 'choose how to apply',
  apply: 'apply, then record it',
  preparing: 'check the preparation',
  verify: 'verify the submission',
};

const phrases: Record<AttentionKind, Words> = {
  browser: () => 'waiting for your OK',
  connection: () => 'wants to connect',
  'profile-recovery': () => 'needs recovery',
  question: () => 'waiting for your answer',
  failure: (item) => (item.tone === 'rose' ? 'failed' : 'interrupted'),
  verify: () => 'verify the submission',
  blocked: () => 'on hold',
  packet: (item) => packetPhrases[item.stage ?? 'approve'],
  brief: () => 'Confirm the job brief first',
  export: () => 'request export approval',
  tracking: (item, data) => {
    const signal = signalOf(item, data);
    return signal ? `proposes ${stateLabels[signal.state]}` : 'proposes an update';
  },
  'role-proposal': () => 'proposes a change',
  'skill-proposal': () => 'proposes a change',
  'instruction-update': () => 'has new default instructions',
  'skill-update': () => 'has an upstream update',
  'writing-suggestion': () => 'proposes a change',
  'profile-proposal': () => 'proposes a change',
};

/** A short phrase after the agent, for the table's Queue cell and the Crew lens: "Scout · failed". */
export const attentionPhrase: Words = (item, data) => phrases[item.kind](item, data);
