import { Circle, Pin, Archive, LoaderCircle, Clock } from 'lucide-react';
import type { ConversationNavigationRow } from '../types.ts';

export const ConversationStatus = ({
  row,
  selected,
}: {
  row: ConversationNavigationRow;
  selected: boolean;
}) => {
  const { conversation: item, unread, working, waiting, waitingForUser } = row;
  return (
    <span className="conversation-link-status">
      {item.pinned ? <Pin size={10} aria-label="Pinned" /> : null}
      {item.archived ? <Archive size={10} aria-label="Archived" /> : null}
      {unread && !selected ? <Circle size={6} fill="currentColor" aria-label="Unread" /> : null}
      {working ? (
        <LoaderCircle size={12} className="spin" aria-label="Working" />
      ) : waiting || waitingForUser ? (
        <Clock size={12} aria-label="Waiting" />
      ) : null}
    </span>
  );
};
