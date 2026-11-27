import type { WorkQueueView } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { QueueMoves } from './types.ts';

export const queueRequestHeading = (queue: WorkQueueView) =>
  queue.requests.length || queue.tasks.length
    ? `${queue.requests.length} ${queue.requests.length === 1 ? 'request' : 'requests'}${queue.tasks.length ? ` · ${queue.tasks.length} crew ${queue.tasks.length === 1 ? 'follow-up' : 'follow-ups'}` : ''}`
    : 'Add the next action';

export const slotFact = (active: number, concurrency: number) =>
  `${active} of ${concurrency} ${concurrency === 1 ? 'slot' : 'slots'}`;

export const backgroundLine = (count: number) =>
  `${count} background ${count === 1 ? 'routine is' : 'routines are'} also running`;

/**
 * The keyboard and menu moves for the item at `index` of the whole ordered list `visible`, each
 * absent when impossible. `head` is the first movable index: an active item stays at the head and
 * is never a destination (the daemon rejects it). `move(beforeId)` makes the handler that places
 * the item before that id, or last for null. Compute over the full list: over a shown subset, Down
 * on the next-to-last shown row would send it to the end of the whole line, and the last shown
 * row would be offered no Down at all.
 */
export const queueMoves = <T extends { id: string }>(
  visible: readonly T[],
  index: number,
  head: number,
  move: (beforeId: string | null) => () => void,
): QueueMoves => {
  const first = visible[head];
  return {
    up: index > head ? move(visible[index - 1]?.id ?? null) : undefined,
    down: index < visible.length - 1 ? move(visible[index + 2]?.id ?? null) : undefined,
    makeNext: index > head && first ? move(first.id) : undefined,
  };
};

/**
 * Saves a new place in the workspace's waiting line: `id` goes before `beforeId`, or last for null.
 * Queue's lists and Home's Up next both reorder through it, so neither spells the endpoint.
 * Reordering never interrupts work.
 */
export const queueMove = (action: Action) => (id: string, beforeId: string | null) =>
  action(`/queue/${encodeURIComponent(id)}`, 'PUT', { action: 'move', beforeId });
