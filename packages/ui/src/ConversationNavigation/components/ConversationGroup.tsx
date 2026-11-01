import { SidebarCategoryTrigger } from '@/AppSidebar/components/SidebarCategoryTrigger.tsx';
import { Collapsible } from '@/components/ui/collapsible/components/Collapsible.tsx';
import { CollapsibleContent } from '@/components/ui/collapsible/components/CollapsibleContent.tsx';
import { ConversationList } from './ConversationList.tsx';
import { GroupAttention } from './GroupAttention.tsx';
import type { ConversationMenuActions } from './ConversationMenu.tsx';
import type { ConversationNavigationRow } from '../types.ts';

/**
 * A collapsible sub-group inside Chats (Agent chats, Agent DMs, Crew history, Archived). Searching
 * opens every group so each match stays visible; a folded group shows its most pressing state.
 */
export const ConversationGroup = ({
  label,
  rows,
  query,
  open,
  setOpen,
  thread,
  closeMobile,
  actions,
  working,
}: {
  label: string;
  rows: ConversationNavigationRow[];
  query: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  thread?: string;
  closeMobile: () => void;
  actions: ConversationMenuActions;
  working: boolean;
}) => {
  const searching = !!query.trim();
  if (searching && !rows.length) return null;
  return (
    <Collapsible
      className="conversation-group"
      open={searching ? true : open}
      onOpenChange={(next) => {
        if (!searching) setOpen(next);
      }}
    >
      <SidebarCategoryTrigger
        label={label}
        count={rows.length}
        indicator={open || searching ? null : <GroupAttention rows={rows} />}
      />
      <CollapsibleContent>
        {rows.length ? (
          <ConversationList
            rows={rows}
            thread={thread}
            closeMobile={closeMobile}
            actions={actions}
            working={working}
            detailed={searching}
          />
        ) : (
          <p className="conversation-group-empty">Nothing here yet.</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
