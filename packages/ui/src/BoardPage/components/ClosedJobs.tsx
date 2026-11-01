import { closedStage } from '@/board-stages.ts';
import { ClayDraggableJob } from '@/ClayInterface/components/ClayDraggableJob.tsx';
import { jobSignals } from '@/ClayInterface/signals.ts';
import type { ClosedJobsProps } from '../types.ts';
import { useJobPage } from '../hooks/useJobPage.ts';
import { useColumnSort } from '../hooks/useColumnSort.ts';
import { sortBoardCards } from '../sorting.ts';
import { groupCount } from '../helpers.ts';
import { JobPages } from './JobPages.tsx';
import { ColumnHeading } from './ColumnHeading.tsx';
import { ColumnEmpty } from './ColumnEmpty.tsx';

/** Every closed job, sorted and paged 40 at a time; dragging one out reopens it. */
export const ClosedJobs = ({
  closed,
  total,
  openCard,
  data,
  working,
  dragging,
  query,
  reveal,
  menuActions,
}: ClosedJobsProps) => {
  const sorting = useColumnSort('closed');
  const sorted = sortBoardCards(closed, sorting.sort);
  const page = useJobPage(sorted, 40, query, reveal, sorting.sort);
  const signals = jobSignals(data);
  const count = groupCount(closed.length, total, query);
  return (
    <section
      id="stage-closed"
      className="clay-closed"
      aria-label={`${closedStage.label}, ${count}`}
    >
      <ColumnHeading
        label={closedStage.label}
        sortLabel="Closed jobs"
        count={count}
        beads={[]}
        disabled={dragging}
        {...sorting}
      />
      <JobPages {...page} label="Closed jobs" disabled={dragging || working} />
      <div className="clay-closed-grid">
        {page.cards.map((card) => (
          <ClayDraggableJob
            key={card.id}
            card={card}
            signal={signals.get(card.id) ?? {}}
            data={data}
            working={working}
            dragging={dragging}
            onOpen={openCard}
            menuActions={menuActions}
          />
        ))}
        {!closed.length ? (
          <ColumnEmpty
            query={query}
            empty="Rejected, withdrawn and unanswered applications end up here."
          />
        ) : null}
      </div>
    </section>
  );
};
