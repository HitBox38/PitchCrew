import type { Approval, BoardEvent, Card, CardState } from '@pitchcrew/core';
import { moveTone } from '../ClayInterface/helpers.ts';
import { stateLabels } from '../lib/labels.ts';

export type JobEventTone = 'done' | 'primary' | 'plum' | 'ochre' | 'moss' | 'teal' | 'rose';

/** One meaningful job change shown as a quiet chip in a job conversation's transcript. */
export interface JobEvent {
  id: string;
  at: string;
  label: string;
  tone?: JobEventTone;
  /** Role ID or `user`, when the change is attributable. */
  actor?: string;
}

const closedTones: Partial<Record<CardState, JobEventTone>> = {
  rejected: 'rose',
  withdrawn: 'rose',
  ghosted: 'rose',
};
const statusTone = (state: CardState): JobEventTone => closedTones[state] ?? moveTone(state);

/** The chip for a saved status move. */
export const jobMove = (id: number, at: string, state: CardState, actor?: string): JobEvent => ({
  id: `status-${id}`,
  at,
  label: stateLabels[state],
  tone: statusTone(state),
  actor,
});

/** Status moves and new drafts seen in the snapshot's recent card events, oldest first. */
const recentMoves = (card: Card, events: BoardEvent[]): JobEvent[] => {
  const found: JobEvent[] = [];
  let previous: Card | undefined;
  for (const event of events
    .filter((item) => item.kind === 'card' && item.entityId === card.id)
    .toSorted((a, b) => a.id - b.id)) {
    const next = event.data as Card;
    if (!next || typeof next.state !== 'string') continue;
    const moved = previous
      ? previous.state !== next.state
      : /^(Moved to|User changed status)/.test(event.message);
    if (previous && next.packet && previous.packet?.resume !== next.packet.resume)
      found.push({
        id: `packet-${event.id}`,
        at: event.createdAt,
        label: previous.packet ? 'Packet revised' : 'Packet drafted',
        tone: 'plum',
        actor: event.actor,
      });
    if (moved) found.push(jobMove(event.id, event.createdAt, next.state, event.actor));
    previous = next;
  }
  return found;
};

const approvalEvents = (approval: Approval): JobEvent[] => {
  const requested: JobEvent = {
    id: `approval-${approval.id}`,
    at: approval.createdAt,
    label: 'Approval requested',
    tone: 'ochre',
  };
  if (!approval.decidedAt || approval.status === 'pending') return [requested];
  const label =
    approval.status === 'rejected'
      ? 'Approval declined'
      : approval.status === 'consumed'
        ? 'Approved and exported'
        : 'Packet approved';
  const tone: JobEventTone = approval.status === 'rejected' ? 'rose' : 'moss';
  const decided = {
    id: `decided-${approval.id}`,
    at: approval.decidedAt,
    label,
    tone,
    actor: 'user',
  };
  return [requested, decided];
};

/**
 * Meaningful changes to a conversation's job since the conversation began: saved card
 * milestones, its approvals, the snapshot's recent card events and `saved` moves/drafts loaded
 * from the job's own history (which win over recent-event chips with the same ID). Repeats of
 * one label within two minutes (a status event and the card field recording it) collapse.
 */
export const jobEvents = (
  card: Card,
  approvals: Approval[],
  events: BoardEvent[],
  since: string,
  saved: JobEvent[] = [],
): JobEvent[] => {
  const known = new Set(saved.map((event) => event.id));
  const found = [...saved, ...recentMoves(card, events).filter((event) => !known.has(event.id))];
  if (card.statusEffectiveAt && !found.some((event) => event.label === stateLabels[card.state]))
    found.push({
      id: `effective-${card.state}`,
      at: card.statusEffectiveAt,
      label: stateLabels[card.state],
      tone: statusTone(card.state),
    });
  const context = card.applicationContext;
  if (context?.confirmedAt)
    found.push({
      id: `brief-${context.confirmedRevision ?? context.revision}`,
      at: context.confirmedAt,
      label: 'Brief confirmed by you',
      tone: 'done',
      actor: 'user',
    });
  if (card.packetReview)
    found.push({
      id: `review-${card.packetReview.runId}`,
      at: card.packetReview.reviewedAt,
      label: 'Packet reviewed',
      tone: 'plum',
    });
  for (const approval of approvals)
    if (approval.cardId === card.id) found.push(...approvalEvents(approval));
  if (card.tracking?.submittedAt)
    found.push({
      id: 'submitted',
      at: card.tracking.submittedAt,
      label: stateLabels.submitted,
      tone: 'moss',
    });
  for (const attempt of card.submissionAttempts ?? [])
    if (attempt.status === 'confirmed' && attempt.resolvedAt)
      found.push({
        id: `attempt-${attempt.id}`,
        at: attempt.resolvedAt,
        label: 'Submission confirmed',
        tone: 'moss',
      });
  const start = Date.parse(since) || 0;
  const kept: JobEvent[] = [];
  for (const event of found
    .filter((item) => Date.parse(item.at) >= start)
    .toSorted((a, b) => a.at.localeCompare(b.at))) {
    const time = Date.parse(event.at);
    const repeat = kept.some(
      (item) => item.label === event.label && Math.abs(Date.parse(item.at) - time) < 120_000,
    );
    if (!repeat) kept.push(event);
  }
  return kept;
};

export interface PlacedJobEvents {
  before?: JobEvent[];
  after?: JobEvent[];
}

/**
 * Hangs each job event on the transcript item it follows. Events before the first item show
 * only on the oldest page and events after the last only on the newest, so paging never repeats
 * them. `joined(index)` marks an item that continues the one before it (a reply under its turn);
 * events never split that pair and move below the reply instead.
 */
export const placeJobEvents = (
  items: { id: string; createdAt: string }[],
  events: JobEvent[],
  edges: { oldest: boolean; newest: boolean },
  joined: (index: number) => boolean = () => false,
) => {
  const placed = new Map<string, PlacedJobEvents>();
  if (!items.length) return placed;
  const add = (id: string, side: keyof PlacedJobEvents, event: JobEvent) => {
    const entry = placed.get(id) ?? {};
    (entry[side] ??= []).push(event);
    placed.set(id, entry);
  };
  const times = items.map((item) => Date.parse(item.createdAt));
  for (const event of events) {
    const at = Date.parse(event.at);
    let index = 0;
    while (index < items.length && times[index] <= at) index += 1;
    if (index === 0) {
      if (edges.oldest) add(items[0].id, 'before', event);
      continue;
    }
    if (index === items.length && !edges.newest) continue;
    let host = index - 1;
    while (host + 1 < items.length && joined(host + 1)) host += 1;
    add(items[host].id, 'after', event);
  }
  return placed;
};
