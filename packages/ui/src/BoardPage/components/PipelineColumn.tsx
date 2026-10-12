import { DraggableJob } from './DraggableJob.tsx';
import { StatusDropTarget } from './StatusDropTarget.tsx';
import { pipelineDrop, type PipelineStage } from '@/BoardPage/helpers.ts';
import type { JobPipelineProps } from '@/BoardPage/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { useDroppable } from '@dnd-kit/react';
import { pointerIntersection } from '@dnd-kit/collision';
import type { Card, CardState, Snapshot } from '@pitchcrew/core';
import { Plus } from 'lucide-react';
import { AnimatePresence } from 'motion/react';

export function PipelineColumn({
  stage,
  cards,
  active,
  data,
  working,
  flashStage,
  setAdd,
  openCard,
  query,
  selection,
}: Pick<JobPipelineProps, 'flashStage' | 'setAdd' | 'openCard' | 'query'> & {
  stage: PipelineStage;
  cards: Card[];
  active: Card | null;
  data: Snapshot;
  working: boolean;
  selection?: CardState | null;
}) {
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
      className={`pipeline-column min-h-110 min-w-0 px-2 pt-2.5 pb-3 max-compact:min-h-80 ${stage.color} ${flashStage === stage.id ? 'flash' : ''}`}
      id={`stage-${stage.id}`}
      aria-labelledby={`heading-${stage.id}`}
      data-drop-allowed={allowed || undefined}
      data-drop-target={(selection === undefined && isDropTarget) || undefined}
    >
      <div className="column-heading mb-2.5 flex h-6.5 items-center gap-2 px-1.5">
        <span className="stage-dot" />
        <h2 id={`heading-${stage.id}`}>{stage.label}</h2>
        <span className="column-count">{cards.length}</span>
        {stage.id === 'lead' ? (
          <Button className="icon-button" aria-label="Add a job" onClick={() => setAdd(true)}>
            <Plus size={15} />
          </Button>
        ) : null}
      </div>
      {active ? (
        <div className="mb-2 flex flex-col gap-1" aria-label={`${stage.label} statuses`}>
          {stage.states.map((state) => (
            <StatusDropTarget
              key={state}
              state={state}
              active={active}
              data={data}
              working={working}
              selection={selection}
            />
          ))}
        </div>
      ) : null}
      <div className="column-cards flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {cards.map((card) => (
            <DraggableJob
              key={card.id}
              card={card}
              data={data}
              disabled={working}
              dragging={!!active}
              openCard={openCard}
            />
          ))}
        </AnimatePresence>
        {!cards.length && !drop ? (
          <p className="column-empty">{query ? 'No matches.' : stage.empty}</p>
        ) : null}
      </div>
    </section>
  );
}
