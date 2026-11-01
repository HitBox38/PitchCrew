import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@pitchcrew/design-system/sidebar';
import { MessagesSquare, Plus } from 'lucide-react';
export const ConversationShortcuts = ({
  openConversations,
  create,
}: {
  openConversations: () => void;
  create: () => void;
}) => {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip="Open chats" aria-label="Open chats" onClick={openConversations}>
          <MessagesSquare />
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="New conversation"
          aria-label="New conversation"
          onClick={create}
        >
          <Plus />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
