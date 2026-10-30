import type { Card } from '@pitchcrew/core';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import { dropStages, stages } from '@/board-stages.ts';
import { pipelinePlugins, pipelineSensors } from '@/BoardPage/constants.ts';
import { usePipelineDrag } from '@/BoardPage/hooks/usePipelineDrag.ts';
import type { useBoardJobMutations } from '@/BoardPage/hooks/useBoardJobMutations.ts';
import { sortBoardCards } from '@/BoardPage/sorting.ts';
import { jobSignals } from '../signals.ts';
import { ClayColumn } from './ClayColumn.tsx';
import { ClayJobCard } from './ClayJobCard.tsx';

type ClayPipelineProps = {
  filtered: Card[];
  openCard: (id: string) => void;
  jobMutations: ReturnType<typeof useBoardJobMutations>;
};

/** Clay columns sharing the classic board's drag rules, menus and focus restoration. */
export const ClayPipeline = ({ filtered, openCard, jobMutations }: ClayPipelineProps) => {
  const { data, working, active, pending, startDrag, endDrag, moveJob, requestDelete } =
    usePipelineDrag(jobMutations);
  if (!data) return null;
  const signals = jobSignals(data);
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
      <div
        className="clay-columns"
        aria-label="Application pipeline"
        aria-busy={!!pending}
        data-dragging={active ? '' : undefined}
      >
        {(active ? dropStages : stages).map((stage) => (
          <ClayColumn
            key={stage.id}
            stage={stage}
            cards={sortBoardCards(
              cards.filter((card) => stage.states.includes(card.state)),
              'fit-desc',
            )}
            signals={signals}
            active={active}
            data={data}
            working={working}
            onOpen={openCard}
            menuActions={{ moveJob, requestDelete }}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null} className="job-drag-overlay">
        {active ? (
          <div aria-hidden="true">
            <ClayJobCard
              card={active}
              signal={signals.get(active.id) ?? {}}
              roles={data.roles}
              onOpen={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DragDropProvider>
  );
};
