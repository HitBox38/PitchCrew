import { PipelineColumn } from './PipelineColumn.tsx';
import { ClosedJobs } from './ClosedJobs.tsx';
import { StatusDestinations } from './StatusDestinations.tsx';
import { pipelinePlugins, pipelineSensors } from '@/BoardPage/constants.ts';
import { usePipelineDrag } from '@/BoardPage/hooks/usePipelineDrag.ts';
import { closedStateSet, dropStages, stages } from '@/board-stages.ts';
import type { JobPipelineProps } from '@/BoardPage/types.ts';
import { JobCard } from '@/components/JobCard/index.tsx';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import * as m from 'motion/react-m';

export const JobPipeline = ({ filtered, showClosed, jobMutations, ...props }: JobPipelineProps) => {
  const { data, working, active, pending, reveal, startDrag, endDrag, moveJob, requestDelete } =
    usePipelineDrag(jobMutations);
  if (!data) return null;
  const menuActions = { moveJob, requestDelete };
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
      {showClosed && active ? (
        <StatusDestinations active={active} data={data} working={working} />
      ) : null}
      {showClosed ? (
        <ClosedJobs
          closed={cards.filter((card) => closedStateSet.has(card.state))}
          openCard={props.openCard}
          data={data}
          working={working}
          dragging={!!active}
          query={props.query}
          menuActions={menuActions}
          reveal={reveal}
        />
      ) : (
        <m.div
          layoutScroll
          className={`pipeline grid min-h-0 flex-1 gap-2.5 overflow-auto pb-1 ${active ? 'grid-cols-[repeat(6,minmax(185px,1fr))] max-mobile:grid-cols-[repeat(6,230px)]' : 'grid-cols-[repeat(5,minmax(185px,1fr))] max-mobile:grid-cols-[repeat(5,230px)]'}`}
          aria-label="Application pipeline"
          aria-busy={!!pending}
        >
          {(active ? dropStages : stages).map((stage) => (
            <PipelineColumn
              key={stage.id}
              stage={stage}
              cards={cards.filter((card) => stage.states.includes(card.state))}
              active={active}
              data={data}
              working={working}
              menuActions={menuActions}
              reveal={reveal}
              {...props}
            />
          ))}
        </m.div>
      )}
      <DragOverlay dropAnimation={null} className="job-drag-overlay">
        {active ? (
          <div aria-hidden="true">
            <JobCard card={active} stationary onOpen={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DragDropProvider>
  );
};
