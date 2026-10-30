import type { Card, Snapshot } from '@pitchcrew/core';
import { useDroppable } from '@dnd-kit/react';
import { pointerIntersection } from '@dnd-kit/collision';
import { pipelineDrop, type PipelineStage } from '@/BoardPage/helpers.ts';
import { StatusDropTarget } from '@/BoardPage/components/StatusDropTarget.tsx';
import type { JobMenuActions } from '@/BoardPage/components/JobActionsMenu/types.ts';
import { stateTone } from '../helpers.ts';
import type { JobSignal } from '../signals.ts';
import { ClayDraggableJob } from './ClayDraggableJob.tsx';

type ClayColumnProps = {
  stage: PipelineStage;
  cards: Card[];
  signals: Map<string, JobSignal>;
  active: Card | null;
  data: Snapshot;
  working: boolean;
  onOpen: (id: string) => void;
  menuActions: JobMenuActions;
};

const visible = 20;

export const ClayColumn = ({ stage, cards, signals, active, ...props }: ClayColumnProps) => {
  const drop = active ? pipelineDrop(active, stage, props.data) : null;
  const allowed = !!drop && drop.kind !== 'blocked';
  const { ref, isDropTarget } = useDroppable({
    id: stage.id,
    disabled: props.working || !allowed,
    collisionDetector: pointerIntersection,
    data: { label: stage.label, action: drop?.label },
  });
  return (
    <section
      ref={ref}
      className="clay-column"
      aria-label={`${stage.label}, ${cards.length}`}
      data-drop-allowed={allowed || undefined}
      data-drop-target={isDropTarget || undefined}
    >
      <header className="clay-column-heading">
        <span>{stage.label}</span>
        <span className="clay-column-count">{cards.length}</span>
        <span className="clay-column-beads" aria-hidden="true">
          {cards.slice(0, 8).map((card) => (
            <span
              key={card.id}
              className="clay-bead"
              data-size="sm"
              data-tone={signals.get(card.id)?.decision ? 'ochre' : stateTone(card.state)}
              data-live={signals.get(card.id)?.run ? '' : undefined}
            />
          ))}
        </span>
      </header>
      {active ? (
        <div className="flex flex-col gap-1" aria-label={`${stage.label} statuses`}>
          {stage.states.map((state) => (
            <StatusDropTarget key={state} state={state} active={active} {...props} />
          ))}
        </div>
      ) : null}
      {cards.slice(0, visible).map((card) => (
        <ClayDraggableJob
          key={card.id}
          card={card}
          signal={signals.get(card.id) ?? {}}
          dragging={!!active}
          {...props}
        />
      ))}
      {!cards.length && !active ? <p className="clay-column-empty">{stage.empty}</p> : null}
      {cards.length > visible ? (
        <p className="clay-column-more">{cards.length - visible} more. Search to find them.</p>
      ) : null}
    </section>
  );
};
