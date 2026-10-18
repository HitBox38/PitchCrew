import { SidebarCategoryTrigger } from '@/AppSidebar/components/SidebarCategoryTrigger.tsx';
import { Collapsible } from '@/components/ui/collapsible/components/Collapsible.tsx';
import { CollapsibleContent } from '@/components/ui/collapsible/components/CollapsibleContent.tsx';
import { ConversationList } from './ConversationList.tsx';
import type { ConversationMenuActions } from './ConversationMenu.tsx';
import type { ConversationNavigationRow } from '../types.ts';

export function ConversationDms({
  rows,
  query,
  open,
  setOpen,
  thread,
  closeMobile,
  actions,
  working,
}: {
  rows: ConversationNavigationRow[];
  query: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  thread?: string;
  closeMobile: () => void;
  actions: ConversationMenuActions;
  working: boolean;
}) {
  return (
    <Collapsible
      className="conversation-dms"
      open={query.trim() ? true : open}
      onOpenChange={(next) => {
        if (!query.trim()) setOpen(next);
      }}
    >
      <SidebarCategoryTrigger label="Agent DMs" count={rows.length} />
      <CollapsibleContent>
        {rows.length ? (
          <ConversationList
            rows={rows}
            thread={thread}
            closeMobile={closeMobile}
            actions={actions}
            working={working}
          />
        ) : (
          <p className="quiet px-2 py-3 text-xs">
            {query.trim() ? 'No matching agent DMs.' : 'No agent DMs yet.'}
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
