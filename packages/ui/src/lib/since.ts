import type { CardState, Run, Snapshot, TrackingSignal } from '@pitchcrew/core';
import { datedAsk, type AttentionItem } from './attention.ts';
import { attentionKindLabel, attentionSubject } from './attention-labels.ts';
import { stateLabels } from './labels.ts';
import { roleName, runDone, runSubject, runWork } from './run-labels.ts';
import { clockLabel, sinceLabel } from './time.ts';

// "Since you were last here": what the crew recorded after a device-local baseline, built from
// complete entity collections (never `data.events`, which holds only the newest 100 and records
// daemon delivery saves as the user). Pitchcrew records crew work only while it is running, so
// nothing here claims what happened while the daemon was stopped.

const day = 86_400_000;

export type SinceWindow = {
  /** Lines must be strictly after this instant. */
  from: number;
  kind: 'default' | 'capped' | 'seen';
  /** The heading's sub-line: "In the last 24 hours", "In the last 7 days" or "since 22:20". */
  label: string;
  /** The window's start after "since", for the empty state: "Nothing recorded since {time}.". */
  time: string;
};

const span = (from: number, now: number, kind: SinceWindow['kind'], label: string) => ({
  from,
  kind,
  label,
  time: sinceLabel(from, now),
});

/** The window from the stored "last here" time: none or unreadable is 24 hours, at most 7 days. */
export const sinceWindow = (stored: string | null | undefined, now: number): SinceWindow => {
  const seen = stored ? Date.parse(stored) : Number.NaN;
  if (Number.isNaN(seen)) return span(now - day, now, 'default', 'In the last 24 hours');
  if (now - seen > 7 * day) return span(now - 7 * day, now, 'capped', 'In the last 7 days');
  const from = Math.min(seen, now);
  return span(from, now, 'seen', `since ${sinceLabel(from, now)}`);
};

export type SinceKind =
  | 'finished'
  | 'failed'
  | 'interrupted'
  | 'stopped'
  | 'ask'
  | 'recorded'
  | 'leads';
export type SinceTarget =
  | { item: string }
  | { cardId: string }
  | { thread: string; run: string }
  | { to: string; search?: Record<string, string> }
  | null;
export type SinceLine = {
  id: string;
  at: string;
  kind: SinceKind;
  tone: 'primary' | 'moss' | 'rose' | 'ochre' | undefined;
  /** The acting agent's role id (its avatar); the text already names it. */
  who: string | null;
  text: string;
  /** A line about a job with an item opens the item, else the job, else the run. */
  target: SinceTarget;
  /** How many things one line stands for ("4 new leads"); 1 when absent. */
  count?: number;
};

/** Recorded statuses that move an application forward; their lines and records take a moss bead. */
export const positiveStates: ReadonlySet<CardState> = new Set([
  'screening',
  'interviewing',
  'offer',
]);
const settled: ReadonlySet<Run['status']> = new Set(['completed', 'failed', 'cancelled']);

/** A routine run that started more than five minutes after its scheduled time says so. */
const late = (run: Run) =>
  run.routineId &&
  run.scheduledFor &&
  Date.parse(run.startedAt) - Date.parse(run.scheduledFor) > 5 * 60_000
    ? ` (scheduled ${clockLabel(run.scheduledFor)}, started ${clockLabel(run.startedAt)})`
    : '';

type Targets = (cardId: string | null) => SinceTarget;

// What the daemon saves on a run it finds unfinished when it starts
// (packages/orchestrator/src/crew/lifecycle.ts:86), matched on its first sentence as chat's
// RunFailure does. The run stopped with Pitchcrew, at a time nothing recorded; its `finishedAt`
// is the restart that found it.
const daemonStopped = 'The daemon stopped during this run.';

/** A routine run names its routine; one deleted since (gone from the snapshot) is "a routine". */
const routineName = (run: Run, data: Snapshot) =>
  data.routines.find((routine) => routine.id === run.routineId)?.name ?? 'a routine';

const runLine = (run: Run, data: Snapshot, targets: Targets): SinceLine => {
  const agent = roleName(data, run.roleId);
  const subject = runSubject(run, data);
  const work = runWork(run, data);
  const base = {
    id: `run:${run.id}`,
    at: run.finishedAt ?? '',
    who: run.roleId,
    target: targets(run.cardId) ?? (run.threadId ? { thread: run.threadId, run: run.id } : null),
  };
  if (run.status === 'completed') {
    // A routine names itself; a routine on a job adds the job, never replaces the routine's name.
    const text =
      run.routineId && !run.purpose
        ? `${agent} ran ${routineName(run, data)}${run.cardId ? ` for ${subject}` : ''}`
        : `${agent} ${runDone(run)} ${subject}`;
    return { ...base, kind: 'finished', tone: 'primary', text: `${text}${late(run)}` };
  }
  // A job-free routine's subject is its own name, and an unknown conversation says nothing.
  const on = subject === work || subject === 'Chat' ? '' : ` on ${subject}`;
  const what = `${agent}’s ${work}${on}`;
  // Worded as Needs you words its queue ("Interrupted request"): never failed, never rose, and no
  // claim about when Pitchcrew stopped. Its only time is the restart that found it, so the line
  // names that time for what it is, and the section shows no clock beside it.
  if (run.status === 'failed' && run.message.startsWith(daemonStopped)) {
    const found = clockLabel(run.finishedAt ?? '');
    return {
      ...base,
      kind: 'interrupted',
      tone: undefined,
      text: `${what} was interrupted when Pitchcrew stopped${found ? ` (found at restart, ${found})` : ''}${late(run)}`,
    };
  }
  return run.status === 'failed'
    ? { ...base, kind: 'failed', tone: 'rose', text: `${what} failed${late(run)}` }
    : { ...base, kind: 'stopped', tone: undefined, text: `Stopped: ${what}${late(run)}` };
};

/** A new ask keeps its Needs you bead: ochre, or rose for a failed request (the bead law). */
const itemLine = (item: AttentionItem, data: Snapshot): SinceLine => ({
  id: `item:${item.key}`,
  at: item.askedAt,
  kind: 'ask',
  tone: item.tone,
  who: item.roleId,
  text: `${attentionKindLabel(item, data)} · ${attentionSubject(item, data)}`,
  target: { item: item.key },
});

/** Auto-applied and user-applied signals end alike with no actor, so no line names the Tracker. */
const signalLine = (signal: TrackingSignal, data: Snapshot, targets: Targets): SinceLine => {
  const card = data.cards.find((entry) => entry.id === signal.cardId);
  return {
    id: `tracking:${signal.id}`,
    at: signal.decidedAt ?? '',
    kind: 'recorded',
    tone: positiveStates.has(signal.state) ? 'moss' : 'primary',
    who: null,
    text: `Recorded ${stateLabels[signal.state]} for ${card?.company ?? signal.company}`,
    target: targets(signal.cardId),
  };
};

/** Lines after `from`, newest first: finished runs, new asks, recorded statuses and new leads. */
export const sinceLines = (
  data: Snapshot,
  from: number,
  items: readonly AttentionItem[],
): SinceLine[] => {
  const after = (iso: string | null | undefined) => !!iso && Date.parse(iso) > from;
  // Items are ranked, so the first one per job is the one its lines open.
  const asked = new Map<string, string>();
  for (const item of items)
    if (item.cardId && !asked.has(item.cardId)) asked.set(item.cardId, item.key);
  const targets: Targets = (cardId) => {
    if (!cardId) return null;
    const key = asked.get(cardId);
    return key ? { item: key } : { cardId };
  };
  const leads = data.cards.filter((card) => card.state === 'lead' && after(card.createdAt));
  const newest = leads.reduce((at, card) => (card.createdAt > at ? card.createdAt : at), '');
  const lines: SinceLine[] = [
    ...data.runs
      .filter(
        (run) => !run.reviewSeatReservation && settled.has(run.status) && after(run.finishedAt),
      )
      .map((run) => runLine(run, data, targets)),
    // A new default instruction version has only a release date, never a time it arrived here.
    ...items
      .filter((item) => datedAsk(item) && after(item.askedAt))
      .map((item) => itemLine(item, data)),
    ...(data.trackingSignals ?? [])
      .filter((signal) => signal.status === 'applied' && after(signal.decidedAt))
      .map((signal) => signalLine(signal, data, targets)),
    ...(leads.length
      ? [
          {
            id: 'leads',
            at: newest,
            kind: 'leads' as const,
            tone: undefined,
            who: null,
            text: `${leads.length} new ${leads.length === 1 ? 'lead' : 'leads'}`,
            // Pipeline, where every lead is; a Not scored view would show fewer than it counts.
            target: { to: '/pipeline' },
            count: leads.length,
          },
        ]
      : []),
  ];
  return lines.sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
};

const parts: [SinceKind, string, string][] = [
  ['finished', 'finished', 'finished'],
  ['failed', 'failed', 'failed'],
  ['interrupted', 'interrupted', 'interrupted'],
  ['stopped', 'stopped', 'stopped'],
  ['ask', 'new ask', 'new asks'],
  ['recorded', 'recorded', 'recorded'],
  ['leads', 'new lead', 'new leads'],
];

/** "3 finished · 1 failed · 2 new asks", zero parts omitted; empty when nothing was recorded. */
export const sinceSummary = (lines: readonly SinceLine[]) =>
  parts
    .map(([kind, one, many]) => {
      const total = lines
        .filter((line) => line.kind === kind)
        .reduce((sum, line) => sum + (line.count ?? 1), 0);
      return total ? `${total} ${total === 1 ? one : many}` : '';
    })
    .filter(Boolean)
    .join(' · ');

/** At most this many lines show; the rest are left to Activity. */
export const sinceLimit = 40;

/** The newest lines to show, and the closing "{n} more in Activity" link when some are left out. */
export const sinceShown = (lines: readonly SinceLine[]) => {
  const more = lines.length - sinceLimit;
  return {
    shown: lines.slice(0, sinceLimit),
    more: more > 0 ? { count: more, text: `${more} more in Activity`, to: '/activity' } : null,
  };
};

/** The empty section's line and its muted explainer; never "Nothing happened". */
export const sinceEmpty = (range: SinceWindow) => `Nothing recorded since ${range.time}.`;
export const sinceExplainer = 'Pitchcrew records crew work only while it is running.';
