import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import { closedStateSet } from '@/board-stages.ts';
import { ClayJobCard } from '@/ClayInterface/components/ClayJobCard.tsx';
import { pipelinePlugins, pipelineSensors } from '../constants.ts';
import { usePipelineDrag } from '../hooks/usePipelineDrag.ts';
import type { ClosedPipelineProps } from '../types.ts';
import { ClosedJobs } from './ClosedJobs.tsx';
import { StatusDestinations } from './StatusDestinations.tsx';

/** The Closed view: closed jobs with drag targets for every status while a job is dragged. */
export const ClosedPipeline = ({ filtered, jobMutations, ...props }: ClosedPipelineProps) => {
  const { data, working, active, pending, reveal, startDrag, endDrag, moveJob, requestDelete } =
    usePipelineDrag(jobMutations);
  if (!data) return null;
  const cards = filtered.map((card) =>
    pending?.id === card.id && pending.from === card.state ? { ...card, state: pending.to } : card,
  );
  return (
    <DragDropProvider
      sensors={pipelineSensors}
      plugins={pipelinePlugins}
      onDragStart={startDrag}
      onDragEnd={(event) => void endDrag(event)}
    >
      {active ? <StatusDestinations active={active} data={data} working={working} /> : null}
      <ClosedJobs
        closed={cards.filter((card) => closedStateSet.has(card.state))}
        total={data.cards.filter((card) => closedStateSet.has(card.state)).length}
        openCard={props.openCard}
        data={data}
        working={working}
        dragging={!!active}
        query={props.query}
        menuActions={{ moveJob, requestDelete }}
        reveal={reveal}
      />
      <DragOverlay dropAnimation={null} className="job-drag-overlay">
        {active ? (
          <div aria-hidden="true">
            <ClayJobCard card={active} signal={{}} data={data} onOpen={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DragDropProvider>
  );
};
