import { SidebarCategory } from '@/AppSidebar/components/SidebarCategory.tsx';
import { SidebarGroupContent } from '@/components/ui/sidebar/components/SidebarGroupContent.tsx';
import { ConversationShortcuts } from './ConversationShortcuts.tsx';
import { ChatsActions } from './ChatsActions.tsx';
import { ChatsList } from './ChatsList.tsx';
import type { useConversationNavigation } from '../hooks/useConversationNavigation.ts';
import type { useConversationActions } from '../hooks/useConversationActions.ts';
import type { ConversationNavigationRow } from '../types.ts';
import { DeleteConversationDialog } from './DeleteConversationDialog.tsx';

export type ConversationNavigationState = ReturnType<typeof useConversationNavigation>;
export type ConversationActionState = ReturnType<typeof useConversationActions>;

/**
 * The sidebar's Chats: Find chats and New conversation in the heading, pinned and ordinary chats,
 * then collapsible Agent DMs, Crew history and Archived. `rows` is the list to show, so a caller can
 * place some conversations elsewhere (job chats nest under their jobs).
 */
export const ConversationNavigationView = ({
  navigation,
  actions,
  rows,
  empty = 'No chats yet.',
}: {
  navigation: ConversationNavigationState;
  actions: ConversationActionState;
  rows: ConversationNavigationRow[];
  empty?: string;
}) => {
  const { iconOnly, create, finding, toggleFind, openConversations } = navigation;
  return (
    <SidebarCategory
      key={iconOnly ? 'icons' : 'expanded'}
      id="conversations"
      label="Chats"
      className="sidebar-conversations"
      action={
        iconOnly ? null : <ChatsActions finding={finding} toggleFind={toggleFind} create={create} />
      }
    >
      <SidebarGroupContent>
        {iconOnly ? (
          <ConversationShortcuts openConversations={openConversations} create={create} />
        ) : (
          <ChatsList navigation={navigation} actions={actions} rows={rows} empty={empty} />
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
};
