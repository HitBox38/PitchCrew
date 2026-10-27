import { PipelineCards } from './PipelineCards.tsx';
import { StatusDropTarget } from './StatusDropTarget.tsx';
import { pipelineDrop, type PipelineStage } from '@/BoardPage/helpers.ts';
import type { JobPipelineProps } from '@/BoardPage/types.ts';
import { useDroppable } from '@dnd-kit/react';
import { pointerIntersection } from '@dnd-kit/collision';
import type { Card, Snapshot } from '@pitchcrew/core';
import { useJobPage, type JobReveal } from '../hooks/useJobPage.ts';
import { JobPages } from './JobPages.tsx';
import type { JobMenuActions } from './JobActionsMenu/types.ts';
import { PipelineHeading } from './PipelineHeading.tsx';
import { useColumnSort } from '../hooks/useColumnSort.ts';
import { sortBoardCards } from '../sorting.ts';

export const PipelineColumn = ({
  stage,
  cards,
  active,
  data,
  working,
  flashStage,
  setAdd,
  openCard,
  query,
  reveal,
  menuActions,
}: Pick<JobPipelineProps, 'flashStage' | 'setAdd' | 'openCard' | 'query'> & {
  stage: PipelineStage;
  cards: Card[];
  active: Card | null;
  data: Snapshot;
  working: boolean;
  reveal: JobReveal;
  menuActions: JobMenuActions;
}) => {
  const sorting = useColumnSort(stage.id);
  const page = useJobPage(sortBoardCards(cards, sorting.sort), 20, query, reveal, sorting.sort);
  const drop = active ? pipelineDrop(active, stage, data) : null;
  const allowed = !!drop && drop.kind !== 'blocked';
  const { ref, isDropTarget } = useDroppable({
    id: stage.id,
    disabled: working || !allowed,
    collisionDetector: pointerIntersection,
    data: { label: stage.label, action: drop?.label },
  });
  return (
    <section
      ref={ref}
      className={`pipeline-column flex min-h-0 min-w-0 flex-col px-2 pt-2.5 pb-2 ${stage.color} ${flashStage === stage.id ? 'flash' : ''}`}
      id={`stage-${stage.id}`}
      aria-labelledby={`heading-${stage.id}`}
      data-drop-allowed={allowed || undefined}
      data-drop-target={isDropTarget || undefined}
    >
      <PipelineHeading
        stage={stage}
        count={cards.length}
        setAdd={setAdd}
        disabled={!!active}
        {...sorting}
      />
      {active ? (
        <div className="mb-2 flex flex-col gap-1" aria-label={`${stage.label} statuses`}>
          {stage.states.map((state) => (
            <StatusDropTarget
              key={state}
              state={state}
              active={active}
              data={data}
              working={working}
            />
          ))}
        </div>
      ) : null}
      <JobPages {...page} label={stage.label} disabled={!!active || working} />
      <PipelineCards
        key={page.page}
        cards={page.cards}
        data={data}
        working={working}
        dragging={!!active}
        openCard={openCard}
        menuActions={menuActions}
        empty={!cards.length && !drop ? (query ? 'No matches.' : stage.empty) : null}
      />
    </section>
  );
};
