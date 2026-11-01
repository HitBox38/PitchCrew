import { Link } from '@tanstack/react-router';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { SidebarMenuSubButton } from '@/components/ui/sidebar/components/SidebarMenuSubButton.tsx';
import { SidebarMenuSubItem } from '@/components/ui/sidebar/components/SidebarMenuSubItem.tsx';
import { ConversationContextMenu } from '@/ConversationNavigation/components/ConversationContextMenu.tsx';
import {
  ConversationMenu,
  type ConversationMenuActions,
} from '@/ConversationNavigation/components/ConversationMenu.tsx';
import { ConversationStatus } from '@/ConversationNavigation/components/ConversationStatus.tsx';
import type { ConversationNavigationRow } from '@/ConversationNavigation/types.ts';
import { shortAge } from '../sidebar-conversations.ts';

const tone = (row: ConversationNavigationRow) =>
  row.waitingForUser ? 'asks' : row.working ? 'working' : undefined;

/** One conversation nested under its job: agent pebbles, title, state bead and age. */
export const ClayJobConversation = ({
  row,
  selected,
  now,
  closeMobile,
  actions,
  working,
}: {
  row: ConversationNavigationRow;
  selected: boolean;
  now: number;
  closeMobile: () => void;
  actions: ConversationMenuActions;
  working: boolean;
}) => {
  const { conversation: item } = row;
  return (
    <ConversationContextMenu row={row} actions={actions} working={working}>
      <SidebarMenuSubItem className="clay-job-conversation">
        <SidebarMenuSubButton
          isActive={selected}
          aria-current={selected ? 'page' : undefined}
          data-tone={tone(row)}
          render={<Link to="/chat/$thread" params={{ thread: item.id }} onClick={closeMobile} />}
        >
          <span className="clay-job-conversation-avatars" aria-hidden="true">
            {item.participants.slice(0, 2).map((id) => (
              <RoleAvatar key={id} agentRole={id} size="small" />
            ))}
          </span>
          <span className="clay-job-conversation-title" title={item.title}>
            {item.title}
          </span>
          <ConversationStatus row={row} selected={selected} />
          <span className="clay-job-conversation-age">
            <span className="sr-only">, updated </span>
            {shortAge(item.updatedAt, now)}
          </span>
        </SidebarMenuSubButton>
        <ConversationMenu row={row} actions={actions} working={working} />
      </SidebarMenuSubItem>
    </ConversationContextMenu>
  );
};
