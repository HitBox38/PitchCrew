import type { ClosedJobsProps } from '@/BoardPage/types.ts';
import { EmptyState } from '@/components/EmptyState/index.tsx';
import { DraggableJob } from './DraggableJob.tsx';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';

export function ClosedJobs({ closed, openCard, data, working, dragging }: ClosedJobsProps) {
  return (
    <m.div
      layout
      className="closed-grid grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(215px,1fr))] content-start gap-3 overflow-auto"
    >
      <AnimatePresence initial={false}>
        {closed.length ? (
          closed.map((card) => (
            <DraggableJob
              key={card.id}
              card={card}
              data={data}
              disabled={working}
              dragging={dragging}
              openCard={openCard}
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
  );
}
