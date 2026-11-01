import { ConversationMenuItems } from './ConversationMenuItems.tsx';
import { Ellipsis } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@pitchcrew/design-system/dropdown-menu';
import { SidebarMenuAction } from '@pitchcrew/design-system/sidebar';
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
        <ConversationMenuItems row={row} actions={actions} working={working} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
