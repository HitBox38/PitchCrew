import type { AgentTask, ChatRequest, Role, Run, Snapshot, WorkQueueView } from '@pitchcrew/core';
import { agoWords, crewRoster, runtimeLine } from '@/CrewPage/helpers.ts';
import { firstStartBlock, startBlock } from './agent-start.ts';
import type { AttentionItem } from './attention.ts';
import { attentionAsk, attentionSubject } from './attention-labels.ts';
import type { LiveRuns } from './live-runs.ts';
// Up next's place in line, so the lens and Home's rail never count the line two ways.
import { lineWords, readyLine, type LinePlace } from './ready-line.ts';
import { requestLabel, roleName, runAction, runSubject } from './run-labels.ts';
import { capitalize, withoutSubject } from './text.ts';
import { ageLabel, durationLabel, sinceLabel, untilLabel } from './time.ts';
import { executingRuns, queueFailed, queueIdentity, runActivityLabel } from './work-queue.ts';

// Crew's At work lens: one row per agent with every job-owned run, wait and failure. It is a view
// over the job and conversation queues (ADR 0002): it never orders work across jobs or lines work
// up by agent, and it decides nothing (a wait leads to its Needs you item on Home). Pure: it
// reads the snapshot, the attention list, the live runs and a clock. Stamps use Crew's compact
// time style ("running 12m", "waiting 4m").

export type LensState = 'running' | 'asks' | 'queued' | 'held' | 'failed';
/** Bead law: plum executes, ochre waits on the user, rose failed, none an empty socket. */
export type LensTone = 'plum' | 'ochre' | 'rose' | undefined;

/**
 * A stamp in parts, so components render it rather than parse it: the state word (the part that
 * takes the bead's tone), then its time; a group whose members' times differ leads with "oldest".
 */
export type Stamp = { lead?: string; word: string; time?: string };

/** "waiting 4m", "oldest failed 05:47 AM": a stamp as one phrase, for names and comparisons. */
export const stampText = ({ lead, word, time }: Stamp) =>
  [lead, word, time].filter(Boolean).join(' ');

/** One job-owned piece of an agent's work. */
export type LensEntry = {
  key: string;
  state: LensState;
  tone: LensTone;
  /** Breathes: a run is executing. A wait on the user stays still. */
  live: boolean;
  cardId: string | null;
  queueId: string | null;
  subject: string;
  action: string;
  detail: string;
  /** "running 12m", "waiting 4m", "queued 9m", "on hold", "failed 22:41", "interrupted". */
  stamp: Stamp;
  /** A counted place in the waiting line (1 is next). */
  position?: number;
  /** Whose crew follow-up this is: the agent that asked for it. */
  followUpFor?: string;
  /** The Needs you item it waits on; it opens Home at that item. */
  itemKey?: string;
  runId?: string;
  threadId?: string;
  /** Running work's job or conversation queue, whose own menu the entry carries. */
  queue?: WorkQueueView;
};

/** Several jobs in one state as one entry: a few names, the shared action and the whole list. */
export type LensGroup = {
  key: string;
  state: Exclude<LensState, 'running'>;
  tone: LensTone;
  /** "Northwind, Kestrel AI, Tidepool", "… and Quill", "… and 3 more". */
  names: string;
  action: string;
  detail: string;
  stamp: Stamp;
  entries: LensEntry[];
};

export type LensItem = LensEntry | LensGroup;

export type LensRow = {
  roleId: string;
  name: string;
  /** "Codex · GPT-6.1 Sol", led by why the agent cannot start ("Paused · Codex · …"). */
  meta: string;
  /** The pebble's rim bead: ochre while the agent asks, else its failed work's, else plum. */
  pebble: LensTone;
  live: boolean;
  items: LensItem[];
  idle: boolean;
  idleFact?: string;
  /** The best rank, in the attention list, of anything it waits on (Infinity for none). */
  urgency: number;
};

/**
 * One fact of a folded row's summary line ("Acme Robotics running 12m", "3 queued"): its subject or
 * count, then a stamp whose state word alone takes the tone.
 */
export type LensFact = { key: string; text: string; stamp: Stamp; tone?: 'ochre' | 'rose' };

export const isLensGroup = (item: LensItem): item is LensGroup => 'entries' in item;

const stateOrder: readonly LensState[] = ['running', 'asks', 'queued', 'held', 'failed'];
/** A state groups from this many entries; running work never groups. */
const groupFrom: Record<LensGroup['state'], number> = { queued: 2, failed: 2, asks: 3, held: 3 };
/** A group names this many jobs before "and N more". */
const named = 3;

/**
 * An entry under construction: its agent, its place in workspace order, when its time counts,
 * whether it waits for a free work slot or is starting in one, and, for work its agent cannot
 * start, what starts it.
 */
type Draft = {
  roleId: string;
  rank: number;
  since: string;
  slot?: boolean;
  starting?: boolean;
  until?: string;
  entry: LensEntry;
};

const runningStamp = (iso: string, now: number): Stamp => {
  const time = durationLabel(iso, now, 'compact');
  if (time === 'just started') return { word: time };
  return time ? { word: 'running', time } : { word: 'running' };
};

/** "waiting 4m", "queued 9m"; under a minute a wait was "asked just now". */
const waitStamp = (word: 'waiting' | 'queued', iso: string, now: number): Stamp => {
  const age = iso ? ageLabel(iso, now, 'compact') : '';
  if (age === 'just now') return { word: word === 'waiting' ? 'asked' : 'queued', time: age };
  return age ? { word, time: age } : { word };
};

/** "failed 05:47 AM" when its run's end is known, else plain "failed". */
const failedStamp = (finishedAt: string, now: number): Stamp => {
  const at = finishedAt ? sinceLabel(Date.parse(finishedAt), now) : '';
  return at ? { word: 'failed', time: at } : { word: 'failed' };
};

/** Indices built once per call, so a long run history and many queues stay cheap. */
const context = (data: Snapshot, items: readonly AttentionItem[], runs: LiveRuns, now: number) => {
  const queues = data.queue?.queues ?? [];
  const queueRank = new Map(queues.map((queue, index) => [queue.id, index]));
  const approvals = new Map(data.computerApprovals.map((approval) => [approval.id, approval]));
  return {
    data,
    items,
    runs,
    now,
    queues,
    approvals,
    queueById: new Map(queues.map((queue) => [queue.id, queue])),
    queueOfRun: new Map(
      queues.flatMap((queue) => queue.runs.map((run) => [run.id, queue] as const)),
    ),
    itemByKey: new Map(items.map((item) => [item.key, item])),
    itemRank: new Map(items.map((item, index) => [item.key, index])),
    /** Runs whose browser request waits in Needs you: they show as that wait, not as working. */
    asking: new Set(
      items.flatMap((item) =>
        item.kind === 'browser' ? [approvals.get(item.entityId)?.runId ?? ''] : [],
      ),
    ),
    slotsFull: !!data.queue && data.queue.active >= data.queue.concurrency,
    /** Workspace queue order, then the order found inside one queue. */
    rank: (queueId: string | null | undefined, step: number) =>
      (queueRank.get(queueId ?? '') ?? queues.length) * 10_000 + step,
  };
};
type Context = ReturnType<typeof context>;

/** Who asked for a crew follow-up; delegates belong to their round, not to a follow-up. */
const followUpOf = (data: Snapshot, task: AgentTask | undefined) => {
  if (!task || task.roundId) return undefined;
  const parent = data.runs.find((run) => run.id === task.parentRunId);
  return parent && parent.roleId !== task.roleId ? roleName(data, parent.roleId) : undefined;
};

const taskAction = (data: Snapshot, task: AgentTask) =>
  `Follow-up for ${roleName(data, data.runs.find((run) => run.id === task.parentRunId)?.roleId)}`;

/**
 * A run's own work in words (its purpose, routine, request or follow-up), or '' when only its
 * conversation's title or "Chat" would stand in for it, or when it only repeats the subject (a
 * routine named as its own run): the entry already names the job.
 */
const workOf = (ctx: Context, run: Run, subject: string) => {
  if (!run.purpose && !run.routineId && !run.requestId && !run.taskId) return '';
  const action = runAction(run, ctx.data);
  return action === subject ? '' : withoutSubject(action, subject);
};

/** What the queue's executing run does, for "After …". */
const currentWork = (ctx: Context, queue: WorkQueueView) => {
  const run = executingRuns(queue.runs.map((item) => ctx.runs.runs.get(item.id) ?? item))[0];
  return run ? workOf(ctx, run, queueIdentity(queue, ctx.data).title) : '';
};

const runningDrafts = (ctx: Context): Draft[] =>
  executingRuns([...ctx.runs.runs.values()])
    .filter((run) => !ctx.asking.has(run.id))
    .toSorted((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((run, step) => {
      const queue = ctx.queueOfRun.get(run.id);
      const subject = runSubject(run, ctx.data);
      const task = run.taskId ? ctx.data.tasks.find((item) => item.id === run.taskId) : undefined;
      return {
        roleId: run.roleId,
        rank: ctx.rank(queue?.id, step),
        since: run.startedAt,
        entry: {
          key: `run:${run.id}`,
          state: 'running',
          tone: 'plum',
          live: true,
          cardId: run.cardId,
          queueId: queue?.id ?? null,
          subject,
          action: workOf(ctx, run, subject),
          detail: runActivityLabel(run),
          stamp: runningStamp(run.startedAt, ctx.now),
          followUpFor: followUpOf(ctx.data, task),
          runId: run.id,
          threadId: run.threadId,
          queue,
        },
      };
    });

/** An ask in Needs you, as the entry of the agent that asks. */
const askEntry = (item: AttentionItem, subject: string, action: string, detail: string) => ({
  key: item.key,
  state: 'asks' as const,
  tone: 'ochre' as const,
  live: false,
  cardId: item.cardId,
  queueId: item.queueId,
  subject,
  action,
  detail,
  itemKey: item.key,
  threadId: item.threadId ?? undefined,
});

/** Browser requests on the agent's live runs and its pending questions. */
const askDrafts = (ctx: Context): Draft[] =>
  ctx.items.flatMap((item, step): Draft[] => {
    if (!item.roleId || (item.kind !== 'browser' && item.kind !== 'question')) return [];
    const subject = attentionSubject(item, ctx.data);
    const stamp = waitStamp('waiting', item.askedAt, ctx.now);
    const base = { roleId: item.roleId, rank: ctx.rank(item.queueId, step), since: item.askedAt };
    if (item.kind === 'browser') {
      const run = ctx.runs.runs.get(ctx.approvals.get(item.entityId)?.runId ?? '');
      const holds = run?.status === 'running' && !run.reviewSeatReservation;
      const ask = `Waiting for your OK: ${attentionAsk(item, ctx.data)}`;
      const action = run ? workOf(ctx, run, subject) : '';
      const detail = holds ? `${ask} · holds its work slot` : ask;
      return [
        { ...base, entry: { ...askEntry(item, subject, action, detail), stamp, runId: run?.id } },
      ];
    }
    const queue = item.queueId ? ctx.queueById.get(item.queueId) : undefined;
    const input = ctx.data.userInputs?.find((entry) => entry.id === item.entityId);
    const run = input ? ctx.runs.runs.get(input.runId) : undefined;
    // The request the asking run waits in. A later request held behind the question is an entry
    // of its own ("Paused until you answer…"), so the ask never borrows its words.
    const asked = queue?.requests.find((request) =>
      request.deliveries.some(
        (delivery) => delivery.roleId === item.roleId && delivery.status === 'waiting',
      ),
    );
    const action = asked ? requestLabel(asked, ctx.data) : run ? workOf(ctx, run, subject) : '';
    // A waiting run releases its slot unless other work in its queue still runs.
    const detail =
      queue?.state === 'running'
        ? 'Waiting for your answer'
        : 'Waiting for your answer · slot released';
    return [
      { ...base, entry: { ...askEntry(item, subject, action, detail), stamp, runId: run?.id } },
    ];
  });

/** Words for a queue held behind another item: it waits on the user, not on its agent. */
const holdWords: Partial<Record<AttentionItem['kind'], string>> = {
  brief: 'Confirm the job brief first',
  verify: 'Verify the submission first',
};

/**
 * The item that explains why a queue waits: a brief promoted over its ready queue, or, for a queue
 * blocked by a fixed server message the attention list dropped, the brief or verify item on its job.
 */
const explainingItem = (ctx: Context, queue: WorkQueueView) => {
  if (queue.state === 'ready')
    return ctx.items.find((item) => item.kind === 'brief' && item.queueId === queue.id);
  if (queue.state !== 'blocked' || !queue.cardId || ctx.itemByKey.has(`blocked:${queue.id}`))
    return undefined;
  return ctx.items.find(
    (item) => (item.kind === 'brief' || item.kind === 'verify') && item.cardId === queue.cardId,
  );
};

/** Why a queue's waiting work cannot start: its bead, the item behind it and its words. */
type Hold = {
  tone: LensTone;
  itemKey?: string;
  /** The reason for one agent's entry: an agent's own question reads "its question". */
  detail: (roleId: string) => string;
  /** For work its own agent cannot start: what starts it ("after you resume Scout in Crew"). */
  until?: string;
};

/**
 * Why a queue's waiting work cannot start, whatever its run state: a question waits, it stopped for
 * Retry or Skip, it is blocked, or the user paused it. A lane paused or asked while one of its runs
 * still executes reports `running`, yet starts nothing new until it is resumed or answered (the
 * server refuses every request in it), so its later work is held, never "after" that run.
 * Undefined while the queue can start its next work.
 */
const holdOf = (
  ctx: Context,
  queue: WorkQueueView,
  explaining: AttentionItem | undefined,
): Hold | undefined => {
  const running = queue.state === 'running';
  // Only a run still executing keeps the lane's slot while its later work waits.
  const slot = running ? '' : ' · slot released';
  // The projection says `waiting` for a question unless a run in the lane still executes.
  const question =
    running || queue.state === 'waiting'
      ? ctx.items.find((item) => item.kind === 'question' && item.queueId === queue.id)
      : undefined;
  if (question || queue.state === 'waiting') {
    const asker = question ? `${roleName(ctx.data, question.roleId)}’s` : 'an agent’s';
    return {
      tone: 'ochre',
      itemKey: question?.key,
      detail: (roleId) =>
        `Paused until you answer ${roleId === question?.roleId ? 'its' : asker} question${slot}`,
    };
  }
  if (queue.paused && (queue.pauseKind === 'failed' || queue.pauseKind === 'interrupted')) {
    const reason = queue.reason || 'Waits for the stopped request to be retried or skipped';
    return {
      // The queue's own bead: rose behind failed work, ochre behind an interruption.
      tone: queueFailed(queue) ? 'rose' : 'ochre',
      itemKey: ctx.itemByKey.get(`failure:${queue.id}`)?.key,
      detail: () => reason,
    };
  }
  if (queue.state === 'blocked') {
    const item =
      explaining ??
      ctx.itemByKey.get(`blocked:${queue.id}`) ??
      ctx.items.find((entry) => entry.kind === 'profile-recovery');
    const reason = (explaining && holdWords[explaining.kind]) || queue.reason || 'On hold';
    return { tone: 'ochre', itemKey: item?.key, detail: () => reason };
  }
  // Paused by the user (older pauses carry no kind): an empty socket until Resume in Queue.
  if (queue.paused) return { tone: undefined, detail: () => 'Paused by you' };
  return undefined;
};

/** The head of a queue held behind a brief or a verify item, as the asking entry of its agents. */
const explainedDrafts = (ctx: Context, queue: WorkQueueView, item: AttentionItem): Draft[] => {
  const head = queue.requests[0];
  if (!head) return [];
  const subject = queueIdentity(queue, ctx.data).title;
  return head.deliveries
    .filter((delivery) => delivery.status === 'queued')
    .map((delivery, step) => ({
      roleId: delivery.roleId,
      rank: ctx.rank(queue.id, step),
      since: item.askedAt,
      entry: {
        ...askEntry(item, subject, requestLabel(head, ctx.data), holdWords[item.kind] ?? ''),
        key: `hold:${queue.id}:${delivery.roleId}`,
        queueId: queue.id,
        stamp: waitStamp('waiting', item.askedAt, ctx.now),
        threadId: queue.threadId,
      },
    }));
};

type QueueScope = {
  ctx: Context;
  queue: WorkQueueView;
  base: Pick<LensEntry, 'cardId' | 'queueId' | 'subject' | 'threadId'>;
  /** Why the queue's waiting work cannot start; none while it can. */
  hold: Hold | undefined;
  failure: string | undefined;
  step: () => number;
};

const failedDraft = (
  scope: QueueScope,
  roleId: string,
  key: string,
  action: string,
  stopped: { error: string; runId: string | null; interrupted: boolean },
  followUpFor?: string,
): Draft => {
  const { ctx, queue } = scope;
  // Only a stopped run's end dates a failure: a request whose launch failed never ran, and when it
  // was queued is not when it failed.
  const at = (stopped.runId && ctx.runs.runs.get(stopped.runId)?.finishedAt) || '';
  return {
    roleId,
    rank: ctx.rank(queue.id, scope.step()),
    since: at,
    entry: {
      ...scope.base,
      key,
      state: 'failed',
      // Bead law: failed work is rose; work a restart interrupted waits on the user, ochre.
      tone: stopped.interrupted ? 'ochre' : 'rose',
      live: false,
      action,
      detail: stopped.interrupted
        ? 'Interrupted when Pitchcrew stopped'
        : stopped.error || queue.reason || 'Stopped before finishing',
      stamp: stopped.interrupted ? { word: 'interrupted' } : failedStamp(at, ctx.now),
      itemKey: scope.failure,
      followUpFor,
    },
  };
};

const heldDraft = (
  scope: QueueScope,
  roleId: string,
  key: string,
  action: string,
  followUpFor?: string,
  hold = scope.hold,
): Draft => ({
  roleId,
  rank: scope.ctx.rank(scope.queue.id, scope.step()),
  since: '',
  until: hold?.until,
  entry: {
    ...scope.base,
    key,
    state: 'held',
    tone: hold?.tone,
    live: false,
    action,
    detail: hold?.detail(roleId) ?? 'On hold',
    // No stored time says when a hold began (`updatedAt` moves on every reorder).
    stamp: { word: 'on hold' },
    itemKey: hold?.itemKey,
    followUpFor,
  },
});

const queuedDraft = (
  scope: QueueScope,
  roleId: string,
  key: string,
  action: string,
  since: string,
  detail: string,
  extra: Partial<LensEntry> & Pick<Draft, 'slot' | 'starting'> = {},
): Draft => {
  const { slot, starting, ...fields } = extra;
  return {
    roleId,
    rank: scope.ctx.rank(scope.queue.id, scope.step()),
    since,
    slot,
    starting,
    entry: {
      ...scope.base,
      key,
      state: 'queued',
      tone: undefined,
      live: false,
      action,
      detail,
      stamp: waitStamp('queued', since, scope.ctx.now),
      ...fields,
    },
  };
};

/** Crew follow-ups in a queue: queued ones run before its next request, failed ones await recovery. */
const taskDrafts = (scope: QueueScope): Draft[] =>
  scope.queue.tasks.flatMap((task): Draft[] => {
    const { ctx, queue } = scope;
    const action = taskAction(ctx.data, task);
    const key = `task:${task.id}`;
    const followUpFor = followUpOf(ctx.data, task);
    if (task.status === 'failed') {
      const interrupted = queue.pauseKind === 'interrupted';
      const stopped = { error: task.error, runId: task.runId, interrupted };
      return [failedDraft(scope, task.roleId, key, action, stopped, followUpFor)];
    }
    if (task.status !== 'queued') return [];
    if (scope.hold) return [heldDraft(scope, task.roleId, key, action, followUpFor)];
    const work = currentWork(ctx, queue);
    const detail = work ? `After ${work}` : 'Runs before the next request in its queue';
    return [queuedDraft(scope, task.roleId, key, action, task.createdAt, detail, { followUpFor })];
  });

type Delivery = ChatRequest['deliveries'][number];

/** One request delivery as an entry of the agent it is assigned to, by where its queue stands. */
const deliveryDraft = (
  scope: QueueScope,
  request: ChatRequest,
  position: number,
  delivery: Delivery,
  place: LinePlace | undefined,
): Draft | undefined => {
  const { ctx, queue } = scope;
  const role = delivery.roleId;
  const key = `request:${request.id}:${role}`;
  const action = requestLabel(request, ctx.data);
  const stopped = { error: delivery.error, runId: delivery.runId, interrupted: false };
  if (delivery.status === 'failed') return failedDraft(scope, role, key, action, stopped);
  // Interrupted by a restart, it waits for Retry or Skip; stopped by the user, it has ended.
  if (delivery.status === 'paused' && delivery.runId)
    return queue.pauseKind === 'interrupted'
      ? failedDraft(scope, role, key, action, { ...stopped, interrupted: true })
      : undefined;
  const at = request.createdAt;
  // A launch under way already holds its slot: it starts, it does not wait for one.
  if (delivery.status === 'running' && !delivery.runId)
    return queuedDraft(scope, role, key, action, at, 'Starting now', {
      starting: true,
      stamp: { word: 'starting' },
    });
  if (delivery.status !== 'queued' && delivery.status !== 'paused') return undefined;
  if (scope.hold) return heldDraft(scope, role, key, action);
  // An agent of its request cannot start it (paused, its runtime missing, unable to isolate a board
  // action or signed out): it waits for the user, never for a slot, and the server holds its queue
  // once a slot frees.
  const block = firstStartBlock(ctx.data, request);
  if (block)
    return heldDraft(scope, role, key, action, undefined, {
      tone: 'ochre',
      detail: () => `Starts ${block.until}`,
      until: block.until,
    });
  if (position === 0 && queue.state === 'ready') {
    const counted = typeof place === 'number' ? place : undefined;
    const detail = counted
      ? `${capitalize(lineWords(counted))} for a free work slot`
      : 'Starting in a free work slot';
    return queuedDraft(scope, role, key, action, at, detail, { slot: true, position: counted });
  }
  const ahead = position > 0 ? requestLabel(queue.requests[0]!, ctx.data) : currentWork(ctx, queue);
  const detail = ahead ? `After ${ahead}` : 'Waits for earlier work in its queue';
  return queuedDraft(scope, role, key, action, at, detail);
};

/** Every request delivery and follow-up a queue holds for an agent, by where the queue stands. */
const queueDrafts = (ctx: Context): Draft[] => {
  const line = new Map(readyLine(ctx.data, ctx.items).map(({ queue, place }) => [queue.id, place]));
  return ctx.queues.flatMap((queue) => {
    const explaining = explainingItem(ctx, queue);
    let count = 0;
    const scope: QueueScope = {
      ctx,
      queue,
      base: {
        cardId: queue.cardId,
        queueId: queue.id,
        subject: queueIdentity(queue, ctx.data).title,
        threadId: queue.threadId,
      },
      hold: holdOf(ctx, queue, explaining),
      failure: ctx.itemByKey.get(`failure:${queue.id}`)?.key,
      step: () => (count += 1),
    };
    const drafts = explaining ? explainedDrafts(ctx, queue, explaining) : [];
    drafts.push(...taskDrafts(scope));
    queue.requests.forEach((request, position) => {
      for (const delivery of request.deliveries) {
        // The head of a queue held behind a brief or a verify item is already that item's ask.
        if (position === 0 && explaining && delivery.status === 'queued') continue;
        const draft = deliveryDraft(scope, request, position, delivery, line.get(queue.id));
        if (draft) drafts.push(draft);
      }
    });
    return drafts;
  });
};

const every = (count: number) => (count === 2 ? 'Both' : `All ${count}`);

const groupDetail = (state: LensGroup['state'], members: Draft[], agent: string, ctx: Context) => {
  const all = every(members.length);
  if (state === 'asks') return `${all} wait on you in Needs you`;
  // Work its own agent cannot start waits on that agent, not in its job queues.
  const until = members[0]?.until;
  if (state === 'held' && until && members.every((member) => member.until === until))
    return `${all} start ${until}`;
  if (state === 'held') return `${all} are on hold in their own job queues`;
  if (state === 'failed') return `${all} stopped before finishing; their job queues are paused`;
  if (members.every((member) => member.starting)) return `${all} are starting`;
  // "Not for {Agent}" only while every slot is busy: then nothing waits for the agent itself.
  if (!ctx.slotsFull)
    return members.every((member) => member.slot)
      ? `${all} start as slots free`
      : `${all} wait in their own job queues`;
  return members.every((member) => member.slot)
    ? `${all} wait for a free work slot, not for ${agent}`
    : `${all} wait in their own job queues, not for ${agent}`;
};

/** A group's state word: what each member's own stamp says. */
const groupWords: Record<LensGroup['state'], string> = {
  asks: 'waiting',
  queued: 'queued',
  held: 'on hold',
  failed: 'failed',
};

/**
 * One shared stamp when the members agree, else the state word with the oldest member's time
 * ("oldest failed 05:47 AM", "oldest waiting 49m"), or the word alone while any time is unknown.
 */
const groupStamp = (state: LensGroup['state'], members: Draft[], now: number): Stamp => {
  const stamps = new Set(members.map((member) => stampText(member.entry.stamp)));
  if (stamps.size === 1) return members[0]!.entry.stamp;
  const word = groupWords[state];
  const times = members.map((member) => member.since);
  if (state === 'held' || times.some((time) => !time)) return { word };
  const oldest = times.toSorted()[0]!;
  const time =
    state === 'failed' ? sinceLabel(Date.parse(oldest), now) : ageLabel(oldest, now, 'compact');
  return { lead: 'oldest', word, time };
};

const groupOf = (
  role: Role,
  state: LensGroup['state'],
  members: Draft[],
  ctx: Context,
): LensGroup => {
  const entries = members.map((member) => member.entry);
  const subjects = [...new Set(entries.map((entry) => entry.subject))];
  const rest = subjects.length - named;
  const tail = rest === 1 ? ` and ${subjects[named]}` : rest > 1 ? ` and ${rest} more` : '';
  return {
    key: `group:${state}:${role.id}`,
    state,
    tone: entries.some((entry) => entry.tone === 'rose')
      ? 'rose'
      : entries.some((entry) => entry.tone === 'ochre')
        ? 'ochre'
        : undefined,
    names: `${subjects.slice(0, named).join(', ')}${tail}`,
    action: [...new Set(entries.map((entry) => entry.action).filter(Boolean))].join(', '),
    detail: groupDetail(state, members, role.name, ctx),
    stamp: groupStamp(state, members, ctx.now),
    entries,
  };
};

/**
 * The agent's own state, as its sidebar row and roster card read it: ochre while it asks the user
 * something, else rose when its work failed (ochre when a restart only interrupted it), else plum
 * while it runs. A hold is its job queue's state, shown on the entry, not the agent's.
 */
const pebbleOf = (entries: readonly LensEntry[]): LensTone => {
  if (entries.some((entry) => entry.state === 'asks')) return 'ochre';
  const failed = entries.filter((entry) => entry.state === 'failed');
  if (failed.some((entry) => entry.tone === 'rose')) return 'rose';
  if (failed.length) return 'ochre';
  return entries.some((entry) => entry.state === 'running') ? 'plum' : undefined;
};

/**
 * An idle agent's facts: paused, a deep review's reserved seat (it holds a slot but never runs),
 * the last job it worked on and its next enabled routine; else nothing running or queued.
 */
const idleFact = (role: Role, ctx: Context) => {
  const runs = [...ctx.runs.runs.values()].filter((run) => run.roleId === role.id);
  const reserved = runs.find((run) => run.status === 'running' && run.reviewSeatReservation);
  const last = runs
    .filter((run) => run.finishedAt && !run.reviewSeatReservation)
    .reduce<Run | undefined>(
      (latest, run) => (!latest || run.finishedAt! > latest.finishedAt! ? run : latest),
      undefined,
    );
  const next = ctx.data.routines
    .filter((routine) => routine.roleId === role.id && routine.enabled && !routine.deletedAt)
    .filter((routine) => routine.nextRunAt)
    .toSorted((a, b) => a.nextRunAt!.localeCompare(b.nextRunAt!))[0];
  // A pause, like a missing runtime, leads the row's meta instead.
  const parts = [
    reserved ? `reserved for ${runSubject(reserved, ctx.data)}’s deep review` : '',
    last
      ? `last worked on ${runSubject(last, ctx.data)} ${agoWords(last.finishedAt!, ctx.now)}`
      : '',
    next ? `next ${next.name} ${untilLabel(Date.parse(next.nextRunAt!), ctx.now)}` : '',
  ].filter(Boolean);
  return parts.length ? capitalize(parts.join(' · ')) : 'Nothing running or queued';
};

const rowOf = (role: Role, drafts: Draft[], ctx: Context): LensRow => {
  const sorted = drafts.toSorted(
    (a, b) =>
      stateOrder.indexOf(a.entry.state) - stateOrder.indexOf(b.entry.state) || a.rank - b.rank,
  );
  const entries = sorted.map((draft) => draft.entry);
  const items = stateOrder.flatMap((state): LensItem[] => {
    const members = sorted.filter((draft) => draft.entry.state === state);
    if (state === 'running' || members.length < groupFrom[state])
      return members.map((member) => member.entry);
    return [groupOf(role, state, members, ctx)];
  });
  const ranks = entries.map((entry) =>
    entry.itemKey ? (ctx.itemRank.get(entry.itemKey) ?? Infinity) : Infinity,
  );
  return {
    roleId: role.id,
    name: role.name,
    meta: [startBlock(ctx.data, role)?.title, runtimeLine(role, ctx.data)]
      .filter(Boolean)
      .join(' · '),
    pebble: pebbleOf(entries),
    live: entries.some((entry) => entry.state === 'running'),
    items,
    idle: !entries.length,
    idleFact: entries.length ? undefined : idleFact(role, ctx),
    urgency: Math.min(Infinity, ...ranks),
  };
};

/** Every current agent in roster order, with its job-owned entries or its idle facts. */
export const crewLens = (
  data: Snapshot,
  items: readonly AttentionItem[],
  runs: LiveRuns,
  now: number,
): LensRow[] => {
  const ctx = context(data, items, runs, now);
  const byRole = new Map<string, Draft[]>();
  for (const draft of [...runningDrafts(ctx), ...askDrafts(ctx), ...queueDrafts(ctx)]) {
    const list = byRole.get(draft.roleId);
    if (list) list.push(draft);
    else byRole.set(draft.roleId, [draft]);
  }
  return crewRoster(data.roles).map((role) => rowOf(role, byRole.get(role.id) ?? [], ctx));
};

const runningCount = (row: LensRow) =>
  row.items.filter((item) => !isLensGroup(item) && item.state === 'running').length;

/**
 * Busy agents, most urgent first: the best-ranked Needs you item they wait on, then the most
 * running work, then roster order.
 */
export const lensOrder = (rows: readonly LensRow[]) =>
  rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !row.idle)
    .toSorted(
      (a, b) =>
        a.row.urgency - b.row.urgency ||
        runningCount(b.row) - runningCount(a.row) ||
        a.index - b.index,
    )
    .map(({ row }) => row.roleId);

/**
 * A folded row's one line: what the agent executes, each with its stamp; one wait or failure by
 * name; the rest counted by state ("2 wait on you", "3 queued", "1 on hold").
 */
export const lensSummary = (row: LensRow): LensFact[] => {
  const entries = row.items.flatMap((item) => (isLensGroup(item) ? item.entries : [item]));
  const of = (state: LensState) => entries.filter((entry) => entry.state === state);
  const asks = of('asks');
  const failed = of('failed');
  const rose = failed.some((entry) => entry.tone === 'rose');
  const interrupted = failed.every((entry) => entry.stamp.word === 'interrupted');
  const counted = (key: string, list: LensEntry[], word: string): LensFact[] =>
    list.length ? [{ key, text: String(list.length), stamp: { word } }] : [];
  return [
    ...of('running').map((entry) => ({ key: entry.key, text: entry.subject, stamp: entry.stamp })),
    ...(asks.length === 1
      ? [
          {
            key: asks[0]!.key,
            text: asks[0]!.subject,
            stamp: asks[0]!.stamp,
            tone: 'ochre' as const,
          },
        ]
      : counted('asks', asks, 'wait on you').map((fact) => ({ ...fact, tone: 'ochre' as const }))),
    ...counted('queued', of('queued'), 'queued'),
    ...counted('held', of('held'), 'on hold'),
    ...(failed.length
      ? [
          {
            key: 'failed',
            text: failed.length === 1 ? failed[0]!.subject : String(failed.length),
            stamp: { word: interrupted ? 'interrupted' : 'failed' },
            tone: rose ? ('rose' as const) : ('ochre' as const),
          },
        ]
      : []),
  ];
};
