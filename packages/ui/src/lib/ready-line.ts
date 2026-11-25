import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { headStartBlock } from './agent-start.ts';
import type { AttentionItem } from './attention.ts';
import { ordinal } from './text.ts';

// The workspace's waiting line, read by Home (Up next and record words), the Pipeline table (the
// Queue cell, its views and bulk Evaluate fit) and Crew's lens, so no view counts it another way.
// Slots belong to job and conversation queues (ADR 0002), never to agents.

/** A place in the waiting line: starting now, behind a brief that waits on you, or counted. */
export type LinePlace = 'starting' | 'brief' | number;

/** A ready queue and its place; `holdsSlot` while it already has its work slot. */
export type LineEntry = { queue: WorkQueueView; place: LinePlace; holdsSlot: boolean };

/** The drain reserves a request's delivery, and its slot, before the run exists. */
const launching = (queue: WorkQueueView) =>
  queue.requests[0]?.deliveries.some((delivery) => delivery.status === 'running') ?? false;

/**
 * Ready queues in workspace order with their places. A queue that already holds a slot reads
 * "starting" without taking a free one: a launch under way, or a crew follow-up that a completed run
 * queued, whose chain keeps the slot until the follow-up starts (a restart or a runtime hold drops
 * the chain, so follow-ups hold only the slots that running queues, routines and launches leave
 * unexplained). A queue behind a promoted brief takes no place. A queue whose next request its agent
 * cannot start (paused, its runtime missing, unable to isolate a board action's application work or
 * waiting for sign-in) is left out: the server never gives it a slot and, once one frees, holds the
 * queue with the reason. Of the rest, the first free slots' worth read "starting", since the drain
 * starts them now, and the others count from 1.
 */
export const readyLine = (
  data: Pick<Snapshot, 'queue' | 'roles' | 'runtimes' | 'runtimeMaintenance' | 'conversations'>,
  items: readonly AttentionItem[],
): LineEntry[] => {
  const queue = data.queue;
  if (!queue) return [];
  const briefHeld = new Set(
    items.flatMap((item) => (item.kind === 'brief' && item.queueId ? [item.queueId] : [])),
  );
  const ready = queue.queues.filter((view) => view.state === 'ready');
  const running = queue.queues.filter((view) => view.state === 'running').length;
  let kept = queue.active - queue.background - running - ready.filter(launching).length;
  let free = Math.max(0, queue.concurrency - queue.active);
  let counted = 0;
  const holds = (view: WorkQueueView) => {
    if (launching(view)) return true;
    if (kept <= 0 || !view.tasks.some((task) => task.status === 'queued')) return false;
    kept -= 1;
    return true;
  };
  return ready.flatMap((view): LineEntry[] => {
    if (holds(view)) return [{ queue: view, place: 'starting', holdsSlot: true }];
    if (briefHeld.has(view.id)) return [{ queue: view, place: 'brief', holdsSlot: false }];
    if (headStartBlock(data, view)) return [];
    let place: LinePlace;
    if (free > 0) {
      free -= 1;
      place = 'starting';
    } else place = counted += 1;
    return [{ queue: view, place, holdsSlot: false }];
  });
};

/** "next in line", "2nd in line"… */
export const lineWords = (place: number) =>
  place === 1 ? 'next in line' : `${ordinal(place)} in line`;
