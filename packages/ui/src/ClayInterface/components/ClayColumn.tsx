import type { Card, Snapshot } from '@pitchcrew/core';
import { useRef } from 'react';
import { useDroppable } from '@dnd-kit/react';
import { pointerIntersection } from '@dnd-kit/collision';
import { groupCount, pipelineDrop, type PipelineStage } from '@/BoardPage/helpers.ts';
import { StatusDropTarget } from '@/BoardPage/components/StatusDropTarget.tsx';
import { ColumnHeading } from '@/BoardPage/components/ColumnHeading.tsx';
import { ColumnEmpty } from '@/BoardPage/components/ColumnEmpty.tsx';
import { JobPages } from '@/BoardPage/components/JobPages.tsx';
import type { JobMenuActions } from '@/BoardPage/components/JobActionsMenu/types.ts';
import { useColumnSort } from '@/BoardPage/hooks/useColumnSort.ts';
import { useJobPage, type JobReveal } from '@/BoardPage/hooks/useJobPage.ts';
import { sortBoardCards } from '@/BoardPage/sorting.ts';
import { columnBeads } from '../jobs.ts';
import type { JobSignal } from '../signals.ts';
import { ClayDraggableJob } from './ClayDraggableJob.tsx';

type ClayColumnProps = {
  stage: PipelineStage;
  /** Jobs in this stage matching the board search; `total` counts the whole stage. */
  cards: Card[];
  total: number;
  query: string;
  reveal: JobReveal;
  selected: boolean;
  signals: Map<string, JobSignal>;
  active: Card | null;
  data: Snapshot;
  working: boolean;
  onOpen: (id: string) => void;
  menuActions: JobMenuActions;
};

/** One stage: sorted and paged after searching, with exact status targets while dragging. */
export const ClayColumn = ({ stage, cards, total, query, reveal, ...props }: ClayColumnProps) => {
  const { signals, active, selected, ...rest } = props;
  const sorting = useColumnSort(stage.id, stage.legacy);
  const sorted = sortBoardCards(cards, sorting.sort);
  const page = useJobPage(sorted, 20, query, reveal, sorting.sort);
  const body = useRef<HTMLDivElement>(null);
  const drop = active ? pipelineDrop(active, stage, props.data) : null;
  const allowed = !!drop && drop.kind !== 'blocked';
  const { ref, isDropTarget } = useDroppable({
    id: stage.id,
    disabled: props.working || !allowed,
    collisionDetector: pointerIntersection,
    data: { label: stage.label, action: drop?.label },
  });
  const count = groupCount(cards.length, total, query);
  return (
    <section
      ref={ref}
      id={`stage-${stage.id}`}
      className="clay-column"
      aria-label={`${stage.label}, ${count}`}
      data-selected={selected || undefined}
      data-drop-allowed={allowed || undefined}
      data-drop-target={isDropTarget || undefined}
    >
      <ColumnHeading
        label={stage.label}
        count={count}
        beads={columnBeads(sorted, signals)}
        disabled={!!active}
        {...sorting}
      />
      <JobPages
        {...page}
        setPage={(next) => {
          page.setPage(next);
          body.current?.scrollTo({ top: 0 });
        }}
        label={stage.label}
        disabled={!!active || props.working}
      />
      {active ? (
        <div className="clay-column-targets" aria-label={`${stage.label} statuses`}>
          {stage.states.map((state) => (
            <StatusDropTarget key={state} state={state} active={active} {...rest} />
          ))}
        </div>
      ) : null}
      <div ref={body} className="clay-column-body">
        {page.cards.map((card) => (
          <ClayDraggableJob
            key={card.id}
            card={card}
            signal={signals.get(card.id) ?? {}}
            dragging={!!active}
            {...rest}
          />
        ))}
        {!cards.length && !active ? <ColumnEmpty query={query} empty={stage.empty} /> : null}
      </div>
    </section>
  );
};
