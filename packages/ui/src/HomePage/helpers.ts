import type { Snapshot } from '@pitchcrew/core';
import type { Decision } from '@/ClayInterface/signals.ts';
import {
  attentionCounts,
  attentionOrder,
  datedAsk,
  type AttentionItem,
  type AttentionKind,
  type AttentionTier,
} from '@/lib/attention.ts';
import { attentionAsk, attentionKindLabel, attentionSubject } from '@/lib/attention-labels.ts';
import { ageLabel, untilLabel } from '@/lib/time.ts';
import { executingRuns } from '@/lib/work-queue.ts';
import { decidedCaption, foldShown, kindNouns, tierCaptions } from './constants.ts';
import type {
  DeskEntry,
  DeskFlight,
  DeskRecord,
  DeskSection,
  DeskState,
  DeskTier,
  LiveEntry,
  RowLine,
} from './types.ts';

/**
 * The title fact's parts: "6 need you" (the Home badge's number), "5 of 5 slots" once the queue
 * is known, and "1 failed" only while a request has failed.
 */
export const factParts = (items: readonly AttentionItem[], data: Pick<Snapshot, 'queue'>) => {
  const { home, failed } = attentionCounts(items);
  return {
    needs: home ? `${home} need${home === 1 ? 's' : ''} you` : 'Nothing needs you',
    slots: data.queue ? `${data.queue.active} of ${data.queue.concurrency} slots` : '',
    failed: failed ? `${failed} failed` : '',
  };
};

/**
 * A closed row's words, in Home's long time style. A release date only ranks its row, so it shows
 * no age; an age under a minute is said "asked just now", never "waiting just now".
 */
export const rowLine = (item: AttentionItem, data: Snapshot, now: number): RowLine => {
  const dated = datedAsk(item);
  return {
    subject: attentionSubject(item, data),
    kind: attentionKindLabel(item, data),
    ask: attentionAsk(item, data),
    context: (item.cardId && data.cards.find((card) => card.id === item.cardId)?.title) || '',
    age: dated ? ageLabel(item.askedAt, now) : '',
    ageCue: dated && now - Date.parse(item.askedAt) < 60_000 ? 'asked' : 'waiting',
    askedAt: item.askedAt,
  };
};

/**
 * Ranked entries grouped by tier, lowest tier first, each in its given order. Past a tier's
 * third entry the rest fold behind one disclosure, except in tier 1 (it ends soon or stops the
 * crew) and for failed work, which stay in view wherever they rank.
 */
export const tierGroups = <T extends { tier: AttentionTier; tone: string }>(
  entries: readonly T[],
) => {
  const groups = new Map<AttentionTier, DeskTier<T>>();
  for (const entry of entries) {
    const group = groups.get(entry.tier) ?? { tier: entry.tier, shown: [], folded: [] };
    groups.set(entry.tier, group);
    const index = group.shown.length + group.folded.length;
    const stays = entry.tier === 1 || entry.tone === 'rose' || index < foldShown;
    (stays ? group.shown : group.folded).push(entry);
  }
  return [...groups.values()].sort((a, b) => a.tier - b.tier);
};

/**
 * The desk's captioned groups. A tier that still holds a live row keeps the caption saying why it
 * ranks there; each run of adjacent tiers that hold only record lines shares one "Decided", so a
 * finished morning reads as one list of what was decided, in rank order, never a stack of the
 * same caption. A run keeps its tiers (and their folds) in order.
 */
export const deskSections = (groups: readonly DeskTier<DeskEntry>[]) => {
  const sections: DeskSection[] = [];
  for (const group of groups) {
    const decided = [...group.shown, ...group.folded].every((entry) => entry.type === 'record');
    const last = sections.at(-1);
    if (decided && last?.decided) last.tiers.push(group);
    else
      sections.push({
        tier: group.tier,
        caption: decided ? decidedCaption : tierCaptions[group.tier],
        decided,
        tiers: [group],
      });
  }
  return sections;
};

const instant = (iso: string) => (iso ? Date.parse(iso) : Number.NaN);

/**
 * A fold's summary: "5 more · tracking reviews and questions · oldest 3 d". It names two kinds at
 * most, then "and others", and leaves out the age when no folded entry has a known start (a
 * release date is not one: `datedAsk`).
 */
export const foldLabel = (
  folded: readonly { kind: AttentionKind; askedAt: string }[],
  now: number,
) => {
  const counts = new Map<AttentionKind, number>();
  for (const entry of folded) counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
  const nouns = [...counts].map(([kind, count]) => kindNouns[kind][count === 1 ? 0 : 1]);
  const kinds =
    nouns.length > 2 ? `${nouns.slice(0, 2).join(', ')} and others` : nouns.join(' and ');
  const known = folded.filter((entry) => datedAsk(entry) && !Number.isNaN(instant(entry.askedAt)));
  const oldest = known.reduce<string | undefined>(
    (first, entry) => (!first || instant(entry.askedAt) < instant(first) ? entry.askedAt : first),
    undefined,
  );
  return [`${folded.length} more`, kinds, oldest ? `oldest ${ageLabel(oldest, now)}` : '']
    .filter(Boolean)
    .join(' · ');
};

/** A fold over desk entries counts what still waits; once all are decided it says how many. */
export const foldSummary = (folded: readonly DeskEntry[], now: number) => {
  const waiting = folded.flatMap((entry) => (entry.type === 'live' ? [entry.item] : []));
  return waiting.length
    ? { label: foldLabel(waiting, now), waiting: true }
    : { label: `${folded.length} decided`, waiting: false };
};

/** A record ranks by its item's own fields and key, so it sorts exactly where the row stood. */
const rankOf = (entry: DeskEntry) => (entry.type === 'live' ? entry.item : entry.record);

/**
 * Every row the desk shows, ranked: the attention items, rows whose call is in flight that a poll
 * snapshot left out (drawn from the view they were decided from), and this session's record lines,
 * each sorted with its item's tier, expiry and age so it stands where its row stood.
 */
export const deskEntries = (
  items: readonly AttentionItem[],
  records: Readonly<Record<string, DeskRecord>>,
  flights: Readonly<Record<string, DeskFlight>>,
): DeskEntry[] => {
  const live = new Set(items.map((item) => item.key));
  const entry = (item: AttentionItem, kept: Snapshot | null): LiveEntry => ({
    type: 'live',
    key: item.key,
    item,
    kept,
    busy: !!flights[item.key],
    tier: item.tier,
    tone: item.tone,
  });
  const held = Object.values(flights).filter(({ view }) => !live.has(view.item.key));
  return [
    ...items.map((item) => entry(item, null)),
    ...held.map(({ view }) => entry(view.item, view.data)),
    ...Object.values(records).map((record) => ({
      type: 'record' as const,
      key: `record:${record.key}:${record.decidedAt}`,
      record,
      tier: record.tier,
      tone: record.tone,
    })),
  ].sort(
    (a, b) =>
      attentionOrder(rankOf(a), rankOf(b)) || (a.type === b.type ? 0 : a.type === 'live' ? -1 : 1),
  );
};

/** Whether the desk still shows this key as a row (waiting, or held while its call runs). */
export const showsRow = (entries: readonly DeskEntry[], key: string) =>
  entries.some((entry) => entry.type === 'live' && entry.key === key);

/** The row that opens after a decision: the most urgent one still waiting and not being decided. */
export const nextOpenKey = (entries: readonly DeskEntry[]) =>
  entries.find((entry) => entry.type === 'live' && !entry.busy && !entry.kept)?.key ?? null;

/** The tier whose fold holds this row, so it can open first; null when the row is in view. */
export const foldTierOf = (entries: readonly DeskEntry[], key: string | null) => {
  if (!key) return null;
  const group = tierGroups(entries).find((tier) => tier.folded.some((entry) => entry.key === key));
  return group?.tier ?? null;
};

/**
 * The desk with the open row's fold opened when ranking has just moved the row behind it: an
 * approved packet is dated by its approval and can sort past its tier's third row, and a promoted
 * brief can land in a full tier. `before` is the fold that held the open row at the last check, so
 * a fold the user closed over the open row stays closed.
 */
export const revealOpenRow = (
  desk: DeskState,
  entries: readonly DeskEntry[],
  before: AttentionTier | null,
): DeskState => {
  const tier = foldTierOf(entries, desk.openKey);
  return tier && tier !== before && !desk.unfolded.has(tier)
    ? { ...desk, unfolded: new Set([...desk.unfolded, tier]) }
    : desk;
};

/** The desk with one row open (or none): since now, remembered as visited, its fold opened. */
export const openRow = (
  desk: DeskState,
  key: string | null,
  entries: readonly DeskEntry[],
  now: number,
): DeskState => {
  const tier = foldTierOf(entries, key);
  return {
    openKey: key,
    armedAt: now,
    visited: key && !desk.visited.has(key) ? new Set([...desk.visited, key]) : desk.visited,
    unfolded: tier && !desk.unfolded.has(tier) ? new Set([...desk.unfolded, tier]) : desk.unfolded,
  };
};

/** A packet or brief item in the shape Decisions' body and footer read. */
export const asDecision = (item: AttentionItem): Decision => ({
  id: item.kind === 'brief' ? `brief-${item.cardId}` : item.entityId,
  kind: item.kind === 'brief' ? 'brief' : item.kind === 'browser' ? 'browser' : 'packet',
  cardId: item.cardId,
  roleId: item.roleId,
  threadId: item.threadId,
  detail: '',
  createdAt: item.askedAt,
  stage: item.stage,
});

/**
 * What the crew does while nothing needs the user, for the desk's close: the jobs it is working
 * on, else the next scheduled routine ("…until Morning scan tomorrow at 08:00"), else that it is
 * idle.
 */
export const crewLine = (data: Pick<Snapshot, 'runs' | 'routines'>, now: number) => {
  const running = executingRuns(data.runs);
  const jobs = new Set(running.flatMap((run) => (run.cardId ? [run.cardId] : []))).size;
  if (jobs) return `The crew is working on ${jobs} ${jobs === 1 ? 'job' : 'jobs'}.`;
  if (running.length) return 'The crew is working.';
  const next = data.routines
    .filter((routine) => routine.enabled && !routine.deletedAt && routine.nextRunAt)
    .toSorted((a, b) => Date.parse(a.nextRunAt!) - Date.parse(b.nextRunAt!))[0];
  return next
    ? `The crew is idle until ${next.name} ${untilLabel(Date.parse(next.nextRunAt!), now)}.`
    : 'The crew is idle.';
};
