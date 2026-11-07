import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import { groupAttention } from '../helpers.ts';
import type { ConversationNavigationRow } from '../types.ts';

/** One bead on a folded group's heading: waiting for you, working, or unread. */
export const GroupAttention = ({ rows }: { rows: ConversationNavigationRow[] }) => {
  const state = groupAttention(rows);
  if (!state) return null;
  return (
    <span className="sidebar-category-bead">
      {state === 'unread' ? (
        <>
          <span className="clay-bead" data-size="sm" data-tone="teal" aria-hidden="true" />
          <span className="sr-only">Unread</span>
        </>
      ) : (
        <StatusBead
          status={state}
          label={
            state === 'failed'
              ? 'Message failed'
              : state === 'waiting'
                ? 'Waiting for you'
                : 'Working'
          }
        />
      )}
    </span>
  );
};
