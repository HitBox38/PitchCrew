import { Archive, ArchiveRestore, Ellipsis, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu/index.tsx';
import { SidebarMenuAction } from '@/components/ui/sidebar/components/SidebarMenuAction.tsx';
import type { Conversation } from '@pitchcrew/core';
import type { ConversationNavigationRow } from '../types.ts';

export interface ConversationMenuActions {
  archive: (item: Conversation) => Promise<void>;
  requestDelete: (item: Conversation) => void;
}
export const ConversationMenu = ({
  row,
  actions,
  working,
}: {
  row: ConversationNavigationRow;
  actions: ConversationMenuActions;
  working: boolean;
}) => {
  const item = row.conversation;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuAction
            type="button"
            id={`conversation-actions-${item.id}`}
            className="conversation-menu-trigger"
            aria-label={`Actions for ${item.title}`}
          />
        }
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={working} onClick={() => void actions.archive(item)}>
            {item.archived ? <ArchiveRestore /> : <Archive />}
            {item.archived ? 'Restore conversation' : 'Archive conversation'}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={working || row.working || row.waitingForUser}
            onClick={() => actions.requestDelete(item)}
          >
            <Trash2 />
            Delete conversation
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
