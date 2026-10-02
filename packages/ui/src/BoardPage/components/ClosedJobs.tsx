import type { ClosedJobsProps } from '@/BoardPage/types.ts';
import { EmptyState } from '@/components/EmptyState/index.tsx';
import { JobCard } from '@/components/JobCard/index.tsx';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';

export function ClosedJobs({ closed, openCard }: ClosedJobsProps) {
  return (
    <m.div layout className="closed-grid">
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
