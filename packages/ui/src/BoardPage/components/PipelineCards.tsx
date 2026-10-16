import { AnimatePresence } from 'motion/react';
import { DraggableJob } from './DraggableJob.tsx';
import type { JobMenuActions } from './JobActionsMenu/types.ts';
import type { Card, Snapshot } from '@pitchcrew/core';

export function PipelineCards({
  cards,
  data,
  working,
  dragging,
  openCard,
  empty,
  menuActions,
}: {
  cards: Card[];
  data: Snapshot;
  working: boolean;
  dragging: boolean;
  openCard: (id: string) => void;
  empty: string | null;
  menuActions: JobMenuActions;
}) {
  return (
    <div className="column-cards flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-1">
      <AnimatePresence initial={false}>
        {cards.map((card) => (
          <DraggableJob
            key={card.id}
            card={card}
            data={data}
            disabled={working}
            dragging={dragging}
            openCard={openCard}
            menuActions={menuActions}
          />
        ))}
      </AnimatePresence>
      {empty ? <p className="column-empty">{empty}</p> : null}
    </div>
  );
}
