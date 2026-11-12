import { useCategoryOpen } from '@/AppSidebar/hooks/useCategoryOpen.ts';
import { useStableCallbacks } from '@/lib/use-stable-callbacks.ts';
import { chatGroups } from '../helpers.ts';
import type { ConversationNavigationRow } from '../types.ts';
import { ConversationGroup } from './ConversationGroup.tsx';
import { ConversationList } from './ConversationList.tsx';
import { ConversationSearch } from './ConversationSearch.tsx';
import type {
  ConversationActionState,
  ConversationNavigationState,
} from './ConversationNavigationView.tsx';

/**
 * Find chats, pinned and named chats, then the folded Agent chats (each role's own chat), Agent DMs,
 * Crew history and Archived.
 */
export const ChatsList = ({
  navigation,
  actions,
  rows,
  empty,
}: {
  navigation: ConversationNavigationState;
  actions: ConversationActionState;
  rows: ConversationNavigationRow[];
  empty: string;
}) => {
  const { query, searchError, setQuery, dmsOpen, setDmsOpen, finding, toggleFind } = navigation;
  const { thread, searchRef, closeMobile } = navigation;
  const agents = useCategoryOpen('chats-agents', false);
  const history = useCategoryOpen('chats-history', false);
  const archived = useCategoryOpen('chats-archived', false);
  const groups = chatGroups(rows);
  const searching = !!query.trim();
  // Stable, so a chat row whose content did not change skips rendering (ConversationLink).
  const callbacks = useStableCallbacks({
    closeMobile,
    archive: actions.archive,
    requestDelete: actions.requestDelete,
  });
  const shared = {
    query,
    thread,
    closeMobile: callbacks.closeMobile,
    actions: callbacks,
    working: actions.working,
  };
  const sub = [
    { label: 'Agent chats', rows: groups.agents, ...agents, setOpen: agents.changeOpen },
    { label: 'Agent DMs', rows: groups.dms, open: dmsOpen, setOpen: setDmsOpen, always: true },
    { label: 'Crew history', rows: groups.history, ...history, setOpen: history.changeOpen },
    { label: 'Archived', rows: groups.archived, ...archived, setOpen: archived.changeOpen },
  ];
  return (
    <nav aria-label="Chats">
      {finding ? (
        <ConversationSearch
          query={query}
          setQuery={setQuery}
          error={searchError}
          inputRef={searchRef}
          close={toggleFind}
        />
      ) : null}
      <ConversationList rows={groups.main} detailed={searching} {...shared} />
      {!groups.main.length && (searching || !groups.agents.length) ? (
        <p className="conversation-group-empty">{searching ? 'No matching chats.' : empty}</p>
      ) : null}
      {sub.map((group) =>
        group.rows.length || group.always ? (
          <ConversationGroup
            key={group.label}
            label={group.label}
            rows={group.rows}
            open={group.open}
            setOpen={group.setOpen}
            {...shared}
          />
        ) : null,
      )}
    </nav>
  );
};
