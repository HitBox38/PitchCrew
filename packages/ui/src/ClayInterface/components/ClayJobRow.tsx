import { ChevronRight } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from '@pitchcrew/design-system/sidebar';
import type { ConversationMenuActions } from '@/ConversationNavigation/components/ConversationMenu.tsx';
import type { ConversationNavigationRow } from '@/ConversationNavigation/types.ts';
import { jobBeadTone } from '../helpers.ts';
import { signalAsks } from '../signals.ts';
import type { SidebarJob } from '../jobs.ts';
import { ClayJobConversation } from './ClayJobConversation.tsx';
import { JobBead } from './JobBead.tsx';

export type ClayJobRowProps = {
  job: SidebarJob;
  rows: ConversationNavigationRow[];
  open: boolean;
  setOpen: (open: boolean) => void;
  onOpenCard: (id: string) => void;
  thread?: string;
  now: number;
  closeMobile: () => void;
  actions: ConversationMenuActions;
  working: boolean;
};

/** A live job; its conversations fold out beneath it as a sub-list. */
export const ClayJobRow = ({ job, rows, open, setOpen, onOpenCard, ...rest }: ClayJobRowProps) => {
  const { card, signal, status } = job;
  const asks = signalAsks(signal);
  const count = `${rows.length} ${rows.length === 1 ? 'conversation' : 'conversations'}`;
  return (
    <Collapsible
      open={open && rows.length > 0}
      onOpenChange={setOpen}
      render={<SidebarMenuItem className="clay-job-item" />}
    >
      <SidebarMenuButton
        tooltip={`${card.company}: ${status}`}
        onClick={() => {
          rest.closeMobile();
          onOpenCard(card.id);
        }}
        className="clay-job-row"
        data-asks={asks ? '' : undefined}
      >
        <JobBead
          tone={jobBeadTone(card.state, {
            asks,
            working: !!signal.run && !asks,
            preparing: signal.decision?.stage === 'preparing',
          })}
          signal={signal}
        />
        <span className="clay-job-company">{card.company}</span>
        <span className="clay-job-status">{status}</span>
      </SidebarMenuButton>
      {rows.length ? (
        <>
          <CollapsibleTrigger
            render={
              <SidebarMenuAction
                className="clay-job-toggle"
                aria-label={`${count} for ${card.company}`}
              />
            }
          >
            {open ? null : <span aria-hidden="true">{rows.length}</span>}
            <ChevronRight aria-hidden="true" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub
              className="clay-job-conversations"
              aria-label={`${card.company} ${count}`}
            >
              {rows.map((row) => (
                <ClayJobConversation
                  key={row.conversation.id}
                  row={row}
                  selected={rest.thread === row.conversation.id}
                  now={rest.now}
                  closeMobile={rest.closeMobile}
                  actions={rest.actions}
                  working={rest.working}
                />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </>
      ) : null}
    </Collapsible>
  );
};
