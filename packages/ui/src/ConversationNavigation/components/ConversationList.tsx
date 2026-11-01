import { SidebarMenu } from '@pitchcrew/design-system/sidebar';
import { ConversationLink } from './ConversationLink.tsx';
import type { ConversationNavigationRow } from '../types.ts';
import type { ConversationMenuActions } from './ConversationMenu.tsx';

/** Chat rows; `detailed` adds the preview line, used for search results. */
export const ConversationList = ({
  rows,
  thread,
  closeMobile,
  actions,
  working,
  detailed = false,
}: {
  rows: ConversationNavigationRow[];
  thread?: string;
  closeMobile: () => void;
  actions: ConversationMenuActions;
  working: boolean;
  detailed?: boolean;
}) => (
  <SidebarMenu>
    {rows.map((row) => (
      <ConversationLink
        key={row.conversation.id}
        row={row}
        selected={thread === row.conversation.id}
        closeMobile={closeMobile}
        actions={actions}
        working={working}
        detailed={detailed}
      />
    ))}
  </SidebarMenu>
);
