import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { menuComponents } from '@/components/ui/context-menu/menu-components.ts';
import type { ConversationNavigationRow } from '../types.ts';
import type { ConversationMenuActions } from './ConversationMenu.tsx';

export const ConversationMenuItems = ({
  row,
  actions,
  working,
  context = false,
}: {
  row: ConversationNavigationRow;
  actions: ConversationMenuActions;
  working: boolean;
  context?: boolean;
}) => {
  const item = row.conversation;
  const Menu = menuComponents(context);
  return (
    <Menu.Group>
      <Menu.Item disabled={working} onClick={() => void actions.archive(item)}>
        {item.archived ? <ArchiveRestore /> : <Archive />}
        {item.archived ? 'Restore conversation' : 'Archive conversation'}
      </Menu.Item>
      <Menu.Item
        variant="destructive"
        disabled={working || row.working || row.waitingForUser}
        onClick={() => actions.requestDelete(item)}
      >
        <Trash2 />
        Delete conversation
      </Menu.Item>
    </Menu.Group>
  );
};
