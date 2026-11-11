import type { CardState } from '@pitchcrew/core';
import { jobMove, type JobEvent } from './job-events.ts';

/** One saved status move or packet draft, as served by `GET /api/cards/:id/changes`. */
export interface CardChange {
  id: number;
  at: string;
  actor: string;
  state?: CardState;
  packet?: 'drafted' | 'revised';
}

export interface CardChangesPage {
  changes: CardChange[];
  older: number | null;
  reachedAt: string | null;
}

/** Pages are 200 events each; ten pages bound one job conversation's lookup. */
const MAX_CHANGE_PAGES = 10;

/**
 * Walks a job's saved changes newest first until a page reaches before `since` (the conversation
 * start), the history ends or the page bound is hit. Changes come back oldest first.
 */
export const loadCardChanges = async (
  page: (before?: number) => Promise<CardChangesPage | undefined>,
  since: string,
  limit = MAX_CHANGE_PAGES,
): Promise<CardChange[]> => {
  const start = Date.parse(since) || 0;
  const found: CardChange[] = [];
  let before: number | undefined;
  for (let count = 0; count < limit; count += 1) {
    const result = await page(before);
    if (!result) break;
    found.push(...result.changes);
    if (result.older === null || !result.reachedAt || Date.parse(result.reachedAt) < start) break;
    before = result.older;
  }
  return found.toReversed();
};

/** Saved changes as transcript chips, sharing IDs with chips read from recent snapshot events. */
export const changeEvents = (changes: CardChange[]): JobEvent[] =>
  changes.flatMap((change) => [
    ...(change.packet
      ? [
          {
            id: `packet-${change.id}`,
            at: change.at,
            label: change.packet === 'revised' ? 'Packet revised' : 'Packet drafted',
            tone: 'plum' as const,
            actor: change.actor,
          },
        ]
      : []),
    ...(change.state ? [jobMove(change.id, change.at, change.state, change.actor)] : []),
  ]);
