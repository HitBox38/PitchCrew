import { SidebarCategory } from '@/AppSidebar/components/SidebarCategory.tsx';
import { SidebarCategoryTrigger } from '@/AppSidebar/components/SidebarCategoryTrigger.tsx';
import { Collapsible } from '@/components/ui/collapsible/components/Collapsible.tsx';
import { CollapsibleContent } from '@/components/ui/collapsible/components/CollapsibleContent.tsx';
import { SidebarGroupAction } from '@/components/ui/sidebar/components/SidebarGroupAction.tsx';
import { SidebarGroupContent } from '@/components/ui/sidebar/components/SidebarGroupContent.tsx';
import { Input } from '@/components/ui/input/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Search, Plus, Archive } from 'lucide-react';
import { ConversationList } from './components/ConversationList.tsx';
import { ConversationShortcuts } from './components/ConversationShortcuts.tsx';
import { useConversationNavigation } from './hooks/useConversationNavigation.ts';
import type { Snapshot } from '@pitchcrew/core';
export function ConversationNavigation({ data }: { data: Snapshot }) {
  const {
    rows,
    query,
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
            <div className="conversation-search">
              <Search size={13} />
              <Input
                ref={searchRef}
                aria-label="Search conversations and messages"
                placeholder="Search conversations"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <ConversationList
              rows={rows.filter((row) => row.conversation.kind !== 'agent_dm')}
              thread={thread}
              closeMobile={closeMobile}
            />
            {!rows.length ? (
              <p className="quiet px-2 py-3 text-sm">No conversations found.</p>
            ) : null}
            <Collapsible
              className="conversation-dms"
              open={query.trim() ? true : dmsOpen}
              onOpenChange={(open) => {
                if (!query.trim()) setDmsOpen(open);
              }}
            >
              <SidebarCategoryTrigger label="Agent DMs" count={dmRows.length} />
              <CollapsibleContent>
                {dmRows.length ? (
                  <ConversationList rows={dmRows} thread={thread} closeMobile={closeMobile} />
                ) : (
                  <p className="quiet px-2 py-3 text-xs">
                    {query.trim() ? 'No matching agent DMs.' : 'No agent DMs yet.'}
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
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
    </SidebarCategory>
  );
}
