import type { ClosedJobsProps } from '@/BoardPage/types.ts';
import { EmptyState } from '@/components/EmptyState/index.tsx';
import { DraggableJob } from './DraggableJob.tsx';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useJobPage } from '../hooks/useJobPage.ts';
import { JobPages } from './JobPages.tsx';

export function ClosedJobs({
  closed,
  openCard,
  data,
  working,
  dragging,
  query,
  reveal,
  menuActions,
}: ClosedJobsProps) {
  const page = useJobPage(closed, 40, query, reveal);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <JobPages {...page} label="Closed jobs" disabled={dragging || working} />
      <m.div
        layout
        className="closed-grid grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(215px,1fr))] content-start gap-3 overflow-auto"
      >
        <AnimatePresence key={page.page} initial={false}>
          {closed.length ? (
            page.cards.map((card) => (
              <DraggableJob
                key={card.id}
                card={card}
                data={data}
                disabled={working}
                dragging={dragging}
                openCard={openCard}
                menuActions={menuActions}
              />
            ))
          ) : (
            <EmptyState
              title="Nothing closed"
              description="Rejected, withdrawn and unanswered applications end up here."
            />
          )}
        </AnimatePresence>
      </m.div>
    </div>
  );
}
