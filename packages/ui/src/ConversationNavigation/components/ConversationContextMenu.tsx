import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu/index.tsx';
import { useRef, type ReactElement } from 'react';
import type { ConversationNavigationRow } from '../types.ts';
import type { ConversationMenuActions } from './ConversationMenu.tsx';
import { ConversationMenuItems } from './ConversationMenuItems.tsx';

export const ConversationContextMenu = ({
  children,
  row,
  actions,
  working,
}: {
  children: ReactElement;
  row: ConversationNavigationRow;
  actions: ConversationMenuActions;
  working: boolean;
}) => {
  const managesFocus = useRef(false);
  const menuActions = {
    archive: (item: Parameters<typeof actions.archive>[0]) => {
      managesFocus.current = true;
      return actions.archive(item);
    },
    requestDelete: (item: Parameters<typeof actions.requestDelete>[0]) => {
      managesFocus.current = true;
      actions.requestDelete(item);
    },
  };
  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) managesFocus.current = false;
      }}
    >
      <ContextMenuTrigger render={children} />
      <ContextMenuContent
        aria-label="Conversation actions"
        finalFocus={() =>
          managesFocus.current
            ? false
            : (document.getElementById(`conversation-actions-${row.conversation.id}`) ?? true)
        }
      >
        <ConversationMenuItems row={row} actions={menuActions} working={working} context />
      </ContextMenuContent>
    </ContextMenu>
  );
};
