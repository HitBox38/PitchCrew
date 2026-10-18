import { SidebarMenu } from '@/components/ui/sidebar/components/SidebarMenu.tsx';
import { ConversationLink } from './ConversationLink.tsx';
import type { ConversationNavigationRow } from '../types.ts';
import type { ConversationMenuActions } from './ConversationMenu.tsx';
export function ConversationList({
  rows,
  thread,
  closeMobile,
  actions,
  working,
}: {
  rows: ConversationNavigationRow[];
  thread?: string;
  closeMobile: () => void;
  actions: ConversationMenuActions;
  working: boolean;
}) {
  return (
    <SidebarMenu>
      {rows.map((row) => (
        <ConversationLink
          key={row.conversation.id}
          row={row}
          selected={thread === row.conversation.id}
          closeMobile={closeMobile}
          actions={actions}
          working={working}
        />
      ))}
    </SidebarMenu>
  );
}
