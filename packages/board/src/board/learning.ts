import {
  applicationInsights,
  assertTransition,
  cardWeightInput,
  insightsQuery,
  lessonInput,
  lessonLimits,
  staleApplyInput,
  staleDays,
  tagKey,
  tagMergeInput,
  type Card,
  type StaleSubmission,
  type TrackingSignal,
} from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import type { Board } from '../index.ts';
import { latestTrackingTime } from './tracking.ts';

const day = 24 * 60 * 60 * 1000;

// Weights, lessons, tag merges and stale cleanup are user-only board writes.
// The HTTP session boundary exposes them; the agent gateway has no matching action.
export function setCardWeight(board: Board, cardId: string, data: unknown): Card {
  const { weight } = cardWeightInput.parse(data);
  return board.db.transaction(() => {
    const card = board.get<Card>('card', cardId);
    const next: Card = { ...card, weight, updatedAt: new Date().toISOString() };
    board.record(
      'card',
      next,
      'user',
      `Set application weight to ${weight > 0 ? '+' : ''}${weight}`,
    );
    return next;
  })();
}
export function addCardLesson(board: Board, cardId: string, data: unknown): Card {
  const { text } = lessonInput.parse(data);
  return board.db.transaction(() => {
    const card = board.get<Card>('card', cardId);
    const lessons = card.lessons ?? [];
    if (lessons.length >= lessonLimits.count)
      throw new Error(
        `An application can keep at most ${lessonLimits.count} lessons. Remove one first.`,
      );
    const now = new Date().toISOString();
    const next: Card = {
      ...card,
      lessons: [...lessons, { id: randomUUID(), text, createdAt: now }],
      updatedAt: now,
    };
    board.record('card', next, 'user', 'Added a lesson');
    return next;
  })();
}
export function removeCardLesson(board: Board, cardId: string, lessonId: string): Card {
  return board.db.transaction(() => {
    const card = board.get<Card>('card', cardId);
    if (!card.lessons?.some((lesson) => lesson.id === lessonId))
      throw new Error('Lesson not found.');
    const next: Card = {
      ...card,
      lessons: card.lessons.filter((lesson) => lesson.id !== lessonId),
      updatedAt: new Date().toISOString(),
    };
    board.record('card', next, 'user', 'Removed a lesson; history keeps the original');
    return next;
  })();
}
/** Moves every card from one tag to another. Dropping the old tag keeps cards within 10 tags. */
export function mergeTags(
  board: Board,
  data: unknown,
): { from: string; to: string; cards: Card[] } {
  const { from, to } = tagMergeInput.parse(data);
  const fromKey = tagKey(from);
  const toKey = tagKey(to);
  return board.db.transaction(() => {
    const changed: Card[] = [];
    for (const card of board.list<Card>('card')) {
      if (!card.tags.some((value) => tagKey(value) === fromKey)) continue;
      const tags: string[] = [];
      let placed = false;
      for (const value of card.tags) {
        const key = tagKey(value);
        if (key === fromKey || key === toKey) {
          if (!placed) tags.push(to);
          placed = true;
        } else tags.push(value);
      }
      if (tags.length > 10) throw new Error(`${card.company} would exceed 10 tags.`);
      const next: Card = { ...card, tags, updatedAt: new Date().toISOString() };
      board.record('card', next, 'user', `Merged tag ${from} into ${to}`);
      changed.push(next);
    }
    if (!changed.length) throw new Error(`No application has the tag ${from}.`);
    return { from, to, cards: changed };
  })();
}
export function boardInsights(board: Board, data: unknown) {
  const query = insightsQuery.parse(data ?? {});
  return applicationInsights(board.list<Card>('card'), query);
}
function enteredState(board: Board, card: Card): { actor: string; createdAt: string } | null {
  let before: number | undefined;
  let newer: { actor: string; createdAt: string } | null = null;
  for (;;) {
    const page = board.history(card.id, before, 200);
    for (const event of page) {
      if (event.kind !== 'card' || !('state' in event.data)) continue;
      if (event.data.state !== card.state) return newer;
      newer = { actor: event.actor, createdAt: event.createdAt };
    }
    if (page.length < 200) return newer;
    before = page.at(-1)!.id;
  }
}
/** Effective time of the last status change, following the tracking effective-time rules. */
export function statusSince(board: Board, card: Card): number {
  const effective = latestTrackingTime(board, card);
  const entered = enteredState(board, card);
  // User changes and accepted tracking evidence carry their own effective time.
  if (!entered || entered.actor === 'user') return effective || Date.parse(card.createdAt);
  const signalled = board
    .list<TrackingSignal>('tracking_signal')
    .some(
      (signal) =>
        signal.cardId === card.id && signal.status === 'applied' && signal.state === card.state,
    );
  return signalled && effective ? effective : Math.max(effective, Date.parse(entered.createdAt));
}
function blocked(board: Board, card: Card): string {
  return card.owner || board.hasActiveRun(card.id) ? 'Application has active workflow work.' : '';
}
export function staleSubmissions(
  board: Board,
  days: unknown,
  now: number = Date.now(),
): { days: number; checkedAt: string; cards: StaleSubmission[] } {
  const threshold = staleDays.parse(days);
  const cards = board
    .list<Card>('card')
    .filter((card) => card.state === 'submitted' && !card.sample)
    .map((card) => {
      const since = statusSince(board, card);
      return {
        id: card.id,
        company: card.company,
        title: card.title,
        updatedAt: card.updatedAt,
        since: new Date(since).toISOString(),
        staleAt: new Date(since + threshold * day).toISOString(),
        idleDays: Math.floor((now - since) / day),
        blocked: blocked(board, card),
      };
    })
    .filter((card) => Date.parse(card.staleAt) <= now)
    .sort((a, b) => a.since.localeCompare(b.since));
  return { days: threshold, checkedAt: new Date(now).toISOString(), cards };
}
/** Applies a reviewed preview. Every selected card is rechecked; any change rejects the batch. */
export function markStaleSubmissions(board: Board, data: unknown): Card[] {
  const input = staleApplyInput.parse(data);
  return board.db.transaction(() => {
    const now = Date.now();
    const ids = new Set<string>();
    return input.cards.map(({ id, updatedAt }) => {
      if (ids.has(id)) throw new Error('Select each application once.');
      ids.add(id);
      const card = board.get<Card>('card', id);
      if (card.updatedAt !== updatedAt)
        throw new Error(`${card.company} changed since the preview. Preview again.`);
      if (card.state !== 'submitted') throw new Error('Only submitted applications can be marked.');
      assertTransition(card.state, 'ghosted');
      const reason = blocked(board, card);
      if (reason) throw new Error(`${card.company}: ${reason}`);
      const since = statusSince(board, card);
      const staleAt = since + input.days * day;
      if (staleAt > now)
        throw new Error(`${card.company} has had a status change in the last ${input.days} days.`);
      const next: Card = {
        ...card,
        state: 'ghosted',
        // Later replies dated after the silence period can still move the card forward.
        statusEffectiveAt: new Date(staleAt).toISOString(),
        updatedAt: new Date(now).toISOString(),
      };
      board.record(
        'card',
        next,
        'user',
        `Marked as no response after ${input.days} days without a status change${input.note ? `: ${input.note}` : ''}`,
      );
      return next;
    });
  })();
}
