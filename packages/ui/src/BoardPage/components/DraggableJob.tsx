import { JobContextMenu } from './JobActionsMenu/components/JobContextMenu.tsx';
import { canDragJob } from '@/BoardPage/helpers.ts';
import { JobCard } from '@/components/JobCard/index.tsx';
import { useDraggable } from '@dnd-kit/react';
import type { Card, Snapshot } from '@pitchcrew/core';
import { JobActionsMenu } from './JobActionsMenu/index.tsx';
import type { JobMenuActions } from './JobActionsMenu/types.ts';
import { useIsPresent } from 'motion/react';

export const DraggableJob = ({
  card,
  data,
  disabled,
  dragging,
  openCard,
  menuActions,
}: {
  card: Card;
  data: Snapshot;
  disabled: boolean;
  dragging: boolean;
  openCard: (id: string) => void;
  menuActions: JobMenuActions;
}) => {
  const present = useIsPresent();
  const movable = present && !disabled && canDragJob(card, data);
  // Gate pointer activation instead of disabling the container and its action menu.
  const { ref, handleRef, isDragSource } = useDraggable({
    id: card.id,
    data: { label: `${card.title} at ${card.company}`, state: card.state, movable },
  });
  const menuProps = {
    card,
    data,
    disabled: disabled || dragging || !present,
    openCard,
    ...menuActions,
  };
  return (
    <JobContextMenu {...menuProps}>
      <div
        ref={ref}
        id={present ? `board-job-${card.id}` : undefined}
        inert={!present}
        aria-hidden={!present || undefined}
        className="draggable-job relative"
        data-card-state={card.state}
        data-movable={movable || undefined}
        data-dragging={isDragSource || undefined}
      >
        <JobCard
          card={card}
          buttonRef={handleRef}
          stationary={dragging}
          onOpen={() => openCard(card.id)}
          actions={<JobActionsMenu {...menuProps} />}
        />
      </div>
    </JobContextMenu>
  );
};
