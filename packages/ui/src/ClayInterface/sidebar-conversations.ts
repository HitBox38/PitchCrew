import type { Conversation } from '@pitchcrew/core';
import type { ConversationNavigationRow } from '../ConversationNavigation/types.ts';
import type { SidebarJob } from './jobs.ts';

export type NestedConversations = {
  /** Conversations shown under their job in the clay sidebar, keyed by card ID. */
  byCard: Map<string, ConversationNavigationRow[]>;
  /** Everything else, kept in the ordinary conversation list. */
  rest: ConversationNavigationRow[];
};

/**
 * Whether a conversation moves under its job. Pinned, archived, agent DM and crew history
 * conversations keep their usual places, as do conversations about jobs not listed in the sidebar.
 */
const nests = (item: Conversation, jobIds: ReadonlySet<string>) =>
  !!item.cardId &&
  jobIds.has(item.cardId) &&
  !item.pinned &&
  !item.archived &&
  item.kind !== 'agent_dm' &&
  item.kind !== 'history';

const rank = (row: ConversationNavigationRow) =>
  row.waitingForUser ? 0 : row.working ? 1 : row.waiting ? 2 : 3;

/**
 * Splits conversation rows between their jobs and the flat list. While searching, every match
 * stays in the flat results so each conversation appears in exactly one place.
 */
export const nestConversations = (
  rows: ConversationNavigationRow[],
  jobs: readonly SidebarJob[],
  query: string,
): NestedConversations => {
  const byCard = new Map<string, ConversationNavigationRow[]>();
  if (query.trim()) return { byCard, rest: rows };
  const jobIds = new Set(jobs.map((job) => job.card.id));
  const rest: ConversationNavigationRow[] = [];
  for (const row of rows) {
    const cardId = row.conversation.cardId;
    if (cardId && nests(row.conversation, jobIds))
      byCard.set(cardId, [...(byCard.get(cardId) ?? []), row]);
    else rest.push(row);
  }
  for (const list of byCard.values())
    list.sort(
      (a, b) =>
        rank(a) - rank(b) || b.conversation.updatedAt.localeCompare(a.conversation.updatedAt),
    );
  return { byCard, rest };
};

/**
 * Jobs that start expanded: the job whose conversation or details are open, and jobs with
 * something waiting on the user. Others start collapsed with a count.
 */
export const openJobIds = (
  jobs: readonly SidebarJob[],
  byCard: NestedConversations['byCard'],
  focus: { threadCardId?: string | null; selectedCardId?: string | null },
) => {
  const open = new Set<string>();
  for (const { card, signal } of jobs) {
    const rows = byCard.get(card.id) ?? [];
    if (
      card.id === focus.threadCardId ||
      card.id === focus.selectedCardId ||
      signal.decision ||
      rows.some((row) => row.waitingForUser)
    )
      open.add(card.id);
  }
  return open;
};

/** Compact age for nested rows: now, 3m, 5h, 2d, then a short date. */
export const shortAge = (date: string, now: number) => {
  const mins = Math.max(0, Math.floor((now - new Date(date).getTime()) / 60_000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  if (mins < 1440 * 30) return `${Math.floor(mins / 1440)}d`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
