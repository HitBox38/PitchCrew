import { memo } from 'react';
import { deepEqual } from '@/lib/share-equal.ts';
import { ConversationContextMenu } from './ConversationContextMenu.tsx';
import { ConversationStatus } from './ConversationStatus.tsx';
import { conversationPreview } from '../presentation.ts';
import { Link } from '@tanstack/react-router';
import { SidebarMenuItem, SidebarMenuButton } from '@pitchcrew/design-system/sidebar';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Users, History } from 'lucide-react';
import type { ConversationNavigationRow } from '../types.ts';
import { ConversationMenu, type ConversationMenuActions } from './ConversationMenu.tsx';

/**
 * One chat: a compact row (pebble, title, state) or, for search results, a two-line row. Its row
 * is rebuilt on every update, so it compares props by content (callbacks are stable).
 */
export const ConversationLink = memo(
  ({
    row,
    selected,
    closeMobile,
    actions,
    working: actionWorking,
    detailed = false,
  }: {
    row: ConversationNavigationRow;
    selected: boolean;
    closeMobile: () => void;
    actions: ConversationMenuActions;
    working: boolean;
    detailed?: boolean;
  }) => {
    const { conversation: item } = row;
    const preview = conversationPreview(row);
    return (
      <ConversationContextMenu row={row} actions={actions} working={actionWorking}>
        <SidebarMenuItem className="conversation-item">
          <SidebarMenuButton
            className="chat-thread conversation-link"
            data-detailed={detailed ? '' : undefined}
            isActive={selected}
            aria-current={selected ? 'page' : undefined}
            aria-label={item.title}
            title={detailed ? undefined : `${item.title}\n${preview}`}
            render={<Link to="/chat/$thread" params={{ thread: item.id }} onClick={closeMobile} />}
          >
            {item.participants.length === 1 && item.kind !== 'history' ? (
              <RoleAvatar agentRole={item.participants[0]} size="small" />
            ) : item.kind === 'history' ? (
              <History size={15} />
            ) : (
              <Users size={15} />
            )}
            <span className="conversation-link-copy">
              <strong>{item.title}</strong>
              {detailed ? <small>{preview}</small> : null}
            </span>
            <ConversationStatus row={row} selected={selected} />
          </SidebarMenuButton>
          <ConversationMenu row={row} actions={actions} working={actionWorking} />
        </SidebarMenuItem>
      </ConversationContextMenu>
    );
  },
  deepEqual,
);
