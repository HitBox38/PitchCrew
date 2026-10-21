import { ConversationContextMenu } from './ConversationContextMenu.tsx';
import { ConversationStatus } from './ConversationStatus.tsx';
import { conversationPreview } from '../presentation.ts';
import { Link } from '@tanstack/react-router';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { SidebarMenuButton } from '@/components/ui/sidebar/components/SidebarMenuButton.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Users, History } from 'lucide-react';
import type { ConversationNavigationRow } from '../types.ts';
import { ConversationMenu, type ConversationMenuActions } from './ConversationMenu.tsx';
export const ConversationLink = ({
  row,
  selected,
  closeMobile,
  actions,
  working: actionWorking,
}: {
  row: ConversationNavigationRow;
  selected: boolean;
  closeMobile: () => void;
  actions: ConversationMenuActions;
  working: boolean;
}) => {
  const { conversation: item } = row;
  return (
    <ConversationContextMenu row={row} actions={actions} working={actionWorking}>
      <SidebarMenuItem>
        <SidebarMenuButton
          className="chat-thread conversation-link"
          isActive={selected}
          aria-current={selected ? 'page' : undefined}
          aria-label={item.title}
          size="lg"
          render={<Link to="/chat/$thread" params={{ thread: item.id }} onClick={closeMobile} />}
        >
          {item.participants.length === 1 && item.kind !== 'history' ? (
            <RoleAvatar agentRole={item.participants[0]} size="small" />
          ) : item.kind === 'history' ? (
            <History size={17} />
          ) : (
            <Users size={17} />
          )}
          <span className="conversation-link-copy">
            <strong title={item.title}>{item.title}</strong>
            <small>{conversationPreview(row)}</small>
          </span>
          <ConversationStatus row={row} selected={selected} />
        </SidebarMenuButton>
        <ConversationMenu row={row} actions={actions} working={actionWorking} />
      </SidebarMenuItem>
    </ConversationContextMenu>
  );
};
