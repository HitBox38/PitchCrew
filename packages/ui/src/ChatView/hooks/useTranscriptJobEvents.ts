import type { Snapshot } from '@pitchcrew/core';
import type { TranscriptItem } from '@/ChatTurn/helpers.ts';
import { jobEvents, placeJobEvents, type PlacedJobEvents } from '../job-events.ts';
import { useJobChanges } from './useJobChanges.ts';

const none = new Map<string, PlacedJobEvents>();

/**
 * Job changes placed among a job conversation's transcript items.
 * Older moves and drafts load from the job's own history; recent snapshot events cover the rest.
 */
export const useTranscriptJobEvents = (
  data: Snapshot,
  thread: string,
  items: TranscriptItem[],
  edges: { oldest: boolean; newest: boolean },
  joined: (index: number) => boolean,
) => {
  const conversation = data.conversations?.find((item) => item.id === thread);
  const card = conversation?.cardId
    ? data.cards.find((item) => item.id === conversation.cardId)
    : undefined;
  const saved = useJobChanges(card, conversation?.createdAt);
  if (!conversation || !card) return none;
  const events = jobEvents(card, data.approvals, data.events, conversation.createdAt, saved);
  return events.length ? placeJobEvents(items, events, edges, joined) : none;
};
