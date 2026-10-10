import { SidebarMenu } from '@/components/ui/sidebar/components/SidebarMenu.tsx';
import { ConversationLink } from './ConversationLink.tsx';
import type { ConversationNavigationRow } from '../types.ts';
export function ConversationList({
  rows,
  thread,
  closeMobile,
}: {
  rows: ConversationNavigationRow[];
  thread?: string;
  closeMobile: () => void;
}) {
  return (
    <SidebarMenu>
      {rows.map((row) => (
        <ConversationLink
          key={row.conversation.id}
          row={row}
          selected={thread === row.conversation.id}
          closeMobile={closeMobile}
        />
      ))}
    </SidebarMenu>
  );
}
