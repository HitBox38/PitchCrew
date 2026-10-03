import type { ClosedJobsProps } from '@/BoardPage/types.ts';
import { EmptyState } from '@/components/EmptyState/index.tsx';
import { JobCard } from '@/components/JobCard/index.tsx';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';

export function ClosedJobs({ closed, openCard }: ClosedJobsProps) {
  return (
    <m.div
      layout
      className="closed-grid grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3"
    >
      <AnimatePresence initial={false}>
        {closed.length ? (
          closed.map((card) => (
            <JobCard key={card.id} card={card} onOpen={() => openCard(card.id)} />
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
