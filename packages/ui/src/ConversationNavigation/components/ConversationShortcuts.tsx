import { SidebarMenu } from '@/components/ui/sidebar/components/SidebarMenu.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { SidebarMenuButton } from '@/components/ui/sidebar/components/SidebarMenuButton.tsx';
import { MessagesSquare, Plus } from 'lucide-react';
export function ConversationShortcuts({
  openConversations,
  create,
}: {
  openConversations: () => void;
  create: () => void;
}) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="Conversations"
          aria-label="Open conversations"
          onClick={openConversations}
        >
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
}
