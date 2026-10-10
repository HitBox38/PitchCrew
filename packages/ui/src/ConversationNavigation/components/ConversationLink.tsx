import { Link } from '@tanstack/react-router';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { SidebarMenuButton } from '@/components/ui/sidebar/components/SidebarMenuButton.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Users, History, Circle, Pin, Archive, LoaderCircle, Clock } from 'lucide-react';
import type { ConversationNavigationRow } from '../types.ts';
export function ConversationLink({
  row,
  selected,
  closeMobile,
}: {
  row: ConversationNavigationRow;
  selected: boolean;
  closeMobile: () => void;
}) {
  const { conversation: item, preview, unread, working, waiting, waitingForUser } = row;
  return (
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
          <small>
            {waitingForUser
              ? 'Waiting for you'
              : working
                ? 'Working…'
                : waiting
                  ? 'Waiting for an agent'
                  : preview}
          </small>
        </span>
        <span className="conversation-link-status">
          {item.pinned ? <Pin size={10} aria-label="Pinned" /> : null}
          {item.archived ? <Archive size={10} aria-label="Archived" /> : null}
          {unread && !selected ? <Circle size={6} fill="currentColor" aria-label="Unread" /> : null}
          {working ? (
            <LoaderCircle size={12} className="spin" aria-label="Working" />
          ) : waiting || waitingForUser ? (
            <Clock size={12} aria-label="Waiting" />
          ) : null}
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
