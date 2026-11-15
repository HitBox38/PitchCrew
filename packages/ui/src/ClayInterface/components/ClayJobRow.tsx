import { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import { deepEqual } from '@/lib/share-equal.ts';
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
import { jobBeadTone } from '../helpers.ts';
import { signalAsks } from '../signals.ts';
import { ClayJobConversation } from './ClayJobConversation.tsx';
import { JobBead } from './JobBead.tsx';
import type { ClayJobRowProps } from '../types.ts';

/**
 * A live job; its conversations fold out beneath it as a sub-list. Its props are rebuilt on every
 * update, so it compares them by content (callbacks are stable, see ClayJobs).
 */
export const ClayJobRow = memo(
  ({ job, rows, open, setJobOpen, onOpenCard, ...rest }: ClayJobRowProps) => {
    const { card, signal, status } = job;
    const asks = signalAsks(signal);
    const count = `${rows.length} ${rows.length === 1 ? 'conversation' : 'conversations'}`;
    return (
      <Collapsible
        open={open && rows.length > 0}
        onOpenChange={(next) => setJobOpen(card.id, next)}
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
  },
  deepEqual,
);
