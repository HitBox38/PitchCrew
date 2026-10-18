import { SidebarCategory } from '@/AppSidebar/components/SidebarCategory.tsx';
import { ConversationDms } from './components/ConversationDms.tsx';
import { SidebarGroupAction } from '@/components/ui/sidebar/components/SidebarGroupAction.tsx';
import { SidebarGroupContent } from '@/components/ui/sidebar/components/SidebarGroupContent.tsx';
import { ConversationSearch } from './components/ConversationSearch.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Plus, Archive } from 'lucide-react';
import { ConversationList } from './components/ConversationList.tsx';
import { ConversationShortcuts } from './components/ConversationShortcuts.tsx';
import { useConversationNavigation } from './hooks/useConversationNavigation.ts';
import type { Snapshot } from '@pitchcrew/core';
import { useConversationActions } from './hooks/useConversationActions.ts';
import { DeleteConversationDialog } from './components/DeleteConversationDialog.tsx';
export function ConversationNavigation({ data }: { data: Snapshot }) {
  const actions = useConversationActions();
  const {
    rows,
    query,
    searchError,
    setQuery,
    archived,
    setArchived,
    dmsOpen,
    setDmsOpen,
    iconOnly,
    create,
    thread,
    searchRef,
    closeMobile,
    openConversations,
  } = useConversationNavigation(data);
  const dmRows = rows.filter((row) => row.conversation.kind === 'agent_dm');
  return (
    <SidebarCategory
      key={iconOnly ? 'icons' : 'expanded'}
      id="conversations"
      label="Conversations"
      className="sidebar-conversations"
      action={
        <SidebarGroupAction type="button" aria-label="New conversation" onClick={create}>
          <Plus />
        </SidebarGroupAction>
      }
    >
      <SidebarGroupContent>
        {iconOnly ? (
          <ConversationShortcuts openConversations={openConversations} create={create} />
        ) : (
          <nav aria-label="Conversations">
            <ConversationSearch
              query={query}
              setQuery={setQuery}
              error={searchError}
              inputRef={searchRef}
            />
            <ConversationList
              rows={rows.filter((row) => row.conversation.kind !== 'agent_dm')}
              thread={thread}
              closeMobile={closeMobile}
              actions={actions}
              working={actions.working}
            />
            {!rows.length ? (
              <p className="quiet px-2 py-3 text-sm">No conversations found.</p>
            ) : null}
            <ConversationDms
              rows={dmRows}
              query={query}
              open={dmsOpen}
              setOpen={setDmsOpen}
              thread={thread}
              closeMobile={closeMobile}
              actions={actions}
              working={actions.working}
            />
            <Button
              className="conversation-archive"
              variant="ghost"
              size="sm"
              onClick={() => setArchived(!archived)}
              aria-pressed={archived}
            >
              <Archive size={13} />
              {archived ? 'Hide archived' : 'Show archived'}
            </Button>
          </nav>
        )}
      </SidebarGroupContent>
      <DeleteConversationDialog
        conversation={actions.deleting}
        working={actions.working}
        close={actions.close}
        confirm={actions.confirm}
      />
    </SidebarCategory>
  );
}
