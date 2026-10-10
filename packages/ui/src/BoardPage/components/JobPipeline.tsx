import { PipelineColumn } from './PipelineColumn.tsx';
import { pipelinePlugins, pipelineSensors } from '@/BoardPage/constants.ts';
import { usePipelineDrag } from '@/BoardPage/hooks/usePipelineDrag.ts';
import { stages } from '@/board-stages.ts';
import type { JobPipelineProps } from '@/BoardPage/types.ts';
import { JobCard } from '@/components/JobCard/index.tsx';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import * as m from 'motion/react-m';

export function JobPipeline({ filtered, ...props }: JobPipelineProps) {
  const { data, working, active, pending, startDrag, endDrag } = usePipelineDrag();
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
      <m.div
        layoutScroll
        className="pipeline grid grid-cols-[repeat(5,minmax(210px,1fr))] gap-3 overflow-x-auto pb-1.5 max-compact:grid-cols-[repeat(5,236px)]"
        aria-label="Application pipeline"
        aria-busy={!!pending}
      >
        {stages.map((stage) => (
          <PipelineColumn
            key={stage.id}
            stage={stage}
            cards={cards.filter((card) => stage.states.includes(card.state))}
            active={active}
            data={data}
            working={working}
            {...props}
          />
        ))}
      </m.div>
      <DragOverlay dropAnimation={null} className="job-drag-overlay">
        {active ? (
          <div aria-hidden="true">
            <JobCard card={active} stationary onOpen={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DragDropProvider>
  );
}
