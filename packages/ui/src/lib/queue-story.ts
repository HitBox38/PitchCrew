import type { Card, Run, Snapshot, WorkQueueView } from '@pitchcrew/core';
import { nextStepText } from '@/ClayInterface/jobs.ts';
import { isFinalSubmission } from '@/ComputerApprovals/helpers.ts';
import { headStartBlock } from './agent-start.ts';
import { datedAsk, type AttentionItem, type AttentionKind } from './attention.ts';
import { attentionKindLabel, attentionPhrase } from './attention-labels.ts';
import { stateLabels } from './labels.ts';
import type { LiveRuns } from './live-runs.ts';
import type { PacketStage } from './packet-stage.ts';
import { readyLine, type LinePlace } from './ready-line.ts';
import { requestLabel, roleName, runAction, runAgentLabel } from './run-labels.ts';
import { capitalize, ordinal, withoutSubject } from './text.ts';
import { ageLabel, clockLabel, durationLabel } from './time.ts';
import { queueStateLabels, queueTone } from './work-queue.ts';

// The Pipeline table's Queue cell: one job's agent story in one line, from the first case that
// applies. What waits on the user, else what runs, else what is starting, else its place in the
// workspace's waiting line, else a hold, else the job's next step. Every index is built once per
// snapshot, so 150 rows never scan the snapshot one by one (no per-row `useJobWork` or `nextUp`).

export type QueueStoryKind =
  | 'asks'
  | 'running'
  | 'reserved'
  | 'starting'
  | 'waiting'
  | 'held'
  | 'idle';

export type QueueStory = {
  kind: QueueStoryKind;
  /** Bead law: ochre waits on the user, rose failed, plum executes; undefined is an empty socket. */
  tone: 'ochre' | 'rose' | 'plum' | undefined;
  /** Plum and breathing while a run executes; a wait on the user stays still. */
  live: boolean;
  agent: string | null;
  text: string;
  /** How long ("4m", "12m"), when it ends ("ends about 10:42") or the place in line ("2nd"). */
  meta: string;
  /** The Needs you item behind the story; its control opens that row on Home and decides nothing. */
  itemKey?: string;
  /** A running story's run, opened by "View". */
  link?: { to: '/chat/$thread'; thread: string; run: string };
  /**
   * The cell's one control: its visible word ("Question") and its accessible name, which starts
   * with that word so speech input finds it ("Question: open Waypoint’s question from Writer on
   * Home").
   */
  control?: { label: string; name: string };
  /** A waiting story's index in the workspace's ready line, which orders the Waiting group. */
  line?: number;
};

type Words = (item: AttentionItem, data: Snapshot) => string;

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

const submission = (item: AttentionItem, data: Snapshot) => {
  const approval = data.computerApprovals.find((entry) => entry.id === item.entityId);
  return !!approval && isFinalSubmission(approval.action);
};

/** The control named for the item it opens, so two asks never share one word. */
const controlLabels: Record<AttentionKind, Words> = {
  browser: (item, data) => (submission(item, data) ? 'Submission' : 'Approval'),
  connection: () => 'Connection',
  'profile-recovery': () => 'Profile',
  question: () => 'Question',
  failure: (item) => (item.tone === 'rose' ? 'Failure' : 'Interruption'),
  verify: () => 'Outcome',
  blocked: () => 'Hold',
  packet: () => 'Packet',
  brief: () => 'Brief',
  export: () => 'Export',
  tracking: (item, data) => {
    const signal = data.trackingSignals?.find((entry) => entry.id === item.entityId);
    return signal ? stateLabels[signal.state] : 'Update';
  },
  'role-proposal': () => 'Change',
  'skill-proposal': () => 'Skill',
  'instruction-update': () => 'Compare',
  'skill-update': () => 'Update',
  'writing-suggestion': () => 'Suggestion',
  'profile-proposal': () => 'Profile',
};

/** A packet as a noun after "{company}’s", by where it stands ("approved packet"). */
const packetNouns: Partial<Record<PacketStage, string>> = {
  approve: 'packet to approve',
  choose: 'approved packet',
  apply: 'exported packet',
  preparing: 'stopped preparation',
};

/** What the control opens, after "{company}’s": "browser action approval", "held queue". */
const controlNoun = (item: AttentionItem, data: Snapshot) =>
  item.kind === 'blocked'
    ? 'held queue'
    : (item.kind === 'packet' && item.stage && packetNouns[item.stage]) ||
      lowerFirst(attentionKindLabel(item, data));

const asksStory = (item: AttentionItem, card: Card, data: Snapshot, now: number): QueueStory => {
  const agent = item.roleId ? roleName(data, item.roleId) : null;
  const phrase = attentionPhrase(item, data);
  const ends =
    item.kind === 'browser' && item.expiresAt ? `ends about ${clockLabel(item.expiresAt)}` : '';
  const label = controlLabels[item.kind](item, data);
  return {
    kind: 'asks',
    tone: item.tone,
    live: false,
    agent,
    text: agent ? phrase : capitalize(phrase),
    meta: ends || (datedAsk(item) ? ageLabel(item.askedAt, now, 'compact') : ''),
    itemKey: item.key,
    control: {
      label,
      name: `${label}: open ${card.company}’s ${controlNoun(item, data)} on Home`,
    },
  };
};

/** The oldest executing run speaks for the job; "+ 1" counts the other agents running on it. */
const runningStory = (executing: readonly Run[], card: Card, data: Snapshot, now: number) => {
  const run = executing[0]!;
  // "Initech: Application work" beside the Initech row would say the company twice.
  const action = withoutSubject(runAction(run, data), card.company);
  // "Follow-up for Reviewer" already says whose follow-up; the agent alone avoids saying it twice.
  const agent = action.startsWith('Follow-up for ')
    ? roleName(data, run.roleId)
    : runAgentLabel(run, data);
  const more = executing.length - 1;
  const story: QueueStory = {
    kind: 'running',
    tone: 'plum',
    live: true,
    agent: more ? `${agent} + ${more}` : agent,
    text: action,
    meta: durationLabel(run.startedAt, now, 'compact'),
  };
  if (!run.threadId) return story;
  return {
    ...story,
    link: { to: '/chat/$thread' as const, thread: run.threadId, run: run.id },
    control: { label: 'View', name: `View ${roleName(data, run.roleId)}’s run on ${card.company}` },
  };
};

/** What a queue starts with: its head request's work and agent, or a crew follow-up. */
const headOf = (queue: WorkQueueView, data: Snapshot) => {
  const head = queue.requests[0];
  if (head) {
    const delivery =
      head.deliveries.find((entry) => entry.status === 'queued') ?? head.deliveries[0];
    return { action: requestLabel(head, data), roleId: delivery?.roleId ?? null };
  }
  const task = queue.tasks.find((entry) => entry.status === 'queued') ?? queue.tasks[0];
  if (!task) return { action: 'Request', roleId: null };
  const parent = data.runs.find((run) => run.id === task.parentRunId);
  return { action: `Follow-up for ${roleName(data, parent?.roleId)}`, roleId: task.roleId };
};

const quiet = (kind: QueueStoryKind, fields: Partial<QueueStory>): QueueStory => ({
  kind,
  tone: undefined,
  live: false,
  agent: null,
  text: '',
  meta: '',
  ...fields,
});

/**
 * A job queue without an item or an executing run: a slot reserved for a deep review, an agent
 * starting (its delivery is reserved before a run exists), its place in the waiting line (the
 * first free slots' worth start now; a queue behind a promoted brief has an item and takes no
 * place, nor does work its agent cannot start, which waits on the user, "Scout · paused"), or a
 * hold.
 */
const queueStory = (
  queue: WorkQueueView,
  data: Snapshot,
  place: { place: LinePlace; index: number } | undefined,
): QueueStory | undefined => {
  const reserved = queue.runs.find((run) => run.status === 'running' && run.reviewSeatReservation);
  if (queue.state === 'running' && reserved)
    return quiet('reserved', {
      agent: roleName(data, reserved.roleId),
      text: 'slot reserved for the deep review',
    });
  const starting = queue.requests[0]?.deliveries.find((entry) => entry.status === 'running');
  if (starting || queue.state === 'running')
    return quiet('starting', {
      text: `Starting ${roleName(data, starting?.roleId ?? headOf(queue, data).roleId)}…`,
    });
  const head = headOf(queue, data);
  const agent = head.roleId ? roleName(data, head.roleId) : null;
  const said = (text: string) => (agent ? text : capitalize(text));
  if (queue.state === 'ready') {
    // A free slot never starts it: the server holds the queue for the agent instead.
    const block = headStartBlock(data, queue);
    if (block)
      return quiet('held', {
        tone: 'ochre',
        agent: roleName(data, block.roleId),
        text: lowerFirst(block.title),
      });
    if (place?.place === 'starting')
      return quiet('waiting', { agent, text: head.action, meta: 'starting', line: place.index });
    if (typeof place?.place !== 'number') return undefined;
    return quiet('waiting', {
      agent,
      text: said('waiting for a slot'),
      meta: ordinal(place.place),
      line: place.index,
    });
  }
  // A saved reason is shown verbatim; a user's pause and a bare state read as phrases.
  const held =
    queue.pauseKind === 'user'
      ? 'paused by you'
      : queue.reason || lowerFirst(queueStateLabels[queue.state]);
  return quiet('held', { tone: queueTone(queue), agent, text: said(held) });
};

/**
 * Every job's Queue cell from one snapshot: the job's highest-ranked attention item, else its
 * executing runs, else its job queue, else its next step (`nextStepText`, which builds no job
 * signals and never says "Waiting on you" for something Home does not list).
 */
export const queueStories = (
  data: Snapshot,
  items: readonly AttentionItem[],
  runs: LiveRuns,
  now: number,
): Map<string, QueueStory> => {
  const asked = new Map<string, AttentionItem>();
  for (const item of items)
    if (item.cardId && !asked.has(item.cardId)) asked.set(item.cardId, item);
  const queues = new Map((data.queue?.queues ?? []).map((queue) => [queue.id, queue]));
  const line = new Map(
    readyLine(data, items).map((entry, index) => [entry.queue.id, { place: entry.place, index }]),
  );
  const stories = new Map<string, QueueStory>();
  for (const card of data.cards) {
    const item = asked.get(card.id);
    const executing = runs.byCard.get(card.id);
    const queue = queues.get(`job:${card.id}`);
    const story = item
      ? asksStory(item, card, data, now)
      : executing?.length
        ? runningStory(executing, card, data, now)
        : queue && queueStory(queue, data, line.get(queue.id));
    stories.set(card.id, story ?? quiet('idle', { text: nextStepText(card, data) ?? '' }));
  }
  return stories;
};
