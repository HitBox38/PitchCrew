import { useEffect } from 'react';
import type { Snapshot } from '@pitchcrew/core';
import type { TranscriptItem } from '@/ChatTurn/helpers.ts';
import {
  clearPendingSend,
  confirmPendingSend,
  pendingMessageId,
  sameSend,
  usePendingSends,
} from '../send-flight.ts';

/**
 * The newest page's items with a just-sent message already in place: after the entries that were
 * on screen at send (first in an empty chat), so a turn that starts before the message is saved
 * still follows it. Once the transcript holds the saved message, that message inherits the copy's
 * key and the copy leaves.
 */
export const usePendingSend = (
  thread: string,
  items: TranscriptItem[],
  chatRequests: Snapshot['chatRequests'],
  newest: boolean,
): TranscriptItem[] => {
  const pending = usePendingSends((state) => state[thread]);
  const request = pending && chatRequests?.find((entry) => entry.submission?.id === pending.id);
  const saved =
    pending &&
    items.find(
      (item) =>
        item.kind === 'message' &&
        (request ? item.id === request.messageId : sameSend(pending, item.message)),
    );
  // During render, so the saved message's first render already uses the copy's key.
  if (pending && saved) confirmPendingSend(saved.id, pending.id);
  useEffect(() => {
    if (pending && saved) clearPendingSend(thread, pending.id);
  }, [thread, pending, saved]);
  if (!pending || saved || !newest) return items;
  const id = pendingMessageId(pending.id);
  const copy: TranscriptItem = {
    kind: 'message',
    id,
    createdAt: pending.createdAt,
    message: {
      id,
      threadId: thread,
      from: 'user',
      to: 'crew',
      content: pending.text,
      cardId: null,
      runId: null,
      createdAt: pending.createdAt,
      references: pending.references,
    },
  };
  const last = items.findLastIndex((item) => pending.before.includes(item.id));
  const at = last >= 0 ? last + 1 : pending.before.length ? items.length : 0;
  return [...items.slice(0, at), copy, ...items.slice(at)];
};
