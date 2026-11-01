import type { Card, Snapshot } from '@pitchcrew/core';
import { useDraggable } from '@dnd-kit/react';
import { canDragJob } from '@/BoardPage/helpers.ts';
import { JobActionsMenu } from '@/BoardPage/components/JobActionsMenu/index.tsx';
import { JobContextMenu } from '@/BoardPage/components/JobActionsMenu/components/JobContextMenu.tsx';
import type { JobMenuActions } from '@/BoardPage/components/JobActionsMenu/types.ts';
import { JobCardSurface } from '@/components/JobCard/components/JobCardSurface.tsx';
import type { JobSignal } from '../signals.ts';
import { ClayJobCard } from './ClayJobCard.tsx';

type ClayDraggableJobProps = {
  card: Card;
  signal: JobSignal;
  data: Snapshot;
  working: boolean;
  dragging: boolean;
  onOpen: (id: string) => void;
  menuActions: JobMenuActions;
};

/** Clay job card with the board's drag, context menu and actions menu on one Motion surface. */
export const ClayDraggableJob = ({
  card,
  signal,
  data,
  working,
  dragging,
  onOpen,
  menuActions,
}: ClayDraggableJobProps) => {
  const movable = !working && canDragJob(card, data);
  // Gate pointer activation instead of disabling the container and its action menu.
  const { ref, handleRef, isDragSource } = useDraggable({
    id: card.id,
    data: { label: `${card.title} at ${card.company}`, state: card.state, movable },
  });
  const menuProps = { card, data, disabled: working || dragging, openCard: onOpen, ...menuActions };
  return (
    <JobContextMenu {...menuProps}>
      <div
        ref={ref}
        id={`board-job-${card.id}`}
        className="draggable-job clay-draggable-job relative"
        data-card-state={card.state}
        data-movable={movable || undefined}
        data-dragging={isDragSource || undefined}
      >
        <JobCardSurface card={card} stationary={dragging}>
          <ClayJobCard
            card={card}
            signal={signal}
            data={data}
            onOpen={onOpen}
            buttonRef={handleRef}
          />
          <JobActionsMenu {...menuProps} />
        </JobCardSurface>
      </div>
    </JobContextMenu>
  );
};
