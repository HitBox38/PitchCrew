import type { TranscriptItem } from '../ChatTurn/helpers.ts';

export const HISTORY_PAGE_SIZE = 50;

/** Anchor older pages by identity so incoming replies never move the reader's page. */
export function historyWindow(items: TranscriptItem[], anchor: string | null) {
  const found = anchor === null ? -1 : items.findIndex((item) => item.id === anchor);
  const start = found < 0 ? Math.max(0, items.length - HISTORY_PAGE_SIZE) : found;
  const end = Math.min(items.length, start + HISTORY_PAGE_SIZE);
  return {
    start,
    end,
    items: items.slice(start, end),
    older: start > 0 ? items[Math.max(0, start - HISTORY_PAGE_SIZE)].id : null,
    newer: end < items.length ? items[end].id : null,
    latest: anchor === null || found < 0,
  };
}
