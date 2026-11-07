import { Pin, Archive } from 'lucide-react';
import type { ConversationNavigationRow } from '../types.ts';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';

export const ConversationStatus = ({
  row,
  selected,
}: {
  row: ConversationNavigationRow;
  selected: boolean;
}) => {
  const { conversation: item, unread, working, waiting, waitingForUser, failed } = row;
  return (
    <span className="conversation-link-status">
      {item.pinned ? <Pin size={10} aria-label="Pinned" /> : null}
      {item.archived ? <Archive size={10} aria-label="Archived" /> : null}
      {working ? (
        <StatusBead status="running" label="Working" />
      ) : failed ? (
        <StatusBead status="failed" label="Message failed" />
      ) : waitingForUser ? (
        <StatusBead status="waiting" label="Waiting for you" />
      ) : waiting ? (
        <StatusBead status="queued" label="Waiting" />
      ) : unread && !selected ? (
        <>
          <span className="clay-bead" data-size="sm" data-tone="teal" aria-hidden="true" />
          <span className="sr-only">Unread</span>
        </>
      ) : null}
    </span>
  );
};
