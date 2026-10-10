import { canDragJob } from '@/BoardPage/helpers.ts';
import { JobCard } from '@/components/JobCard/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { useDraggable } from '@dnd-kit/react';
import type { Card, Snapshot } from '@pitchcrew/core';
import { GripVertical } from 'lucide-react';

export function DraggableJob({
  card,
  data,
  disabled,
  dragging,
  openCard,
}: {
  card: Card;
  data: Snapshot;
  disabled: boolean;
  dragging: boolean;
  openCard: (id: string) => void;
}) {
  const movable = canDragJob(card, data);
  const { ref, handleRef, isDragSource } = useDraggable({
    id: card.id,
    disabled: disabled || !movable,
    data: { label: `${card.title} at ${card.company}` },
  });
  return (
    <div
      ref={ref}
      id={`board-job-${card.id}`}
      className="draggable-job relative"
      data-card-state={card.state}
      data-dragging={isDragSource || undefined}
    >
      <JobCard card={card} stationary={dragging} onOpen={() => openCard(card.id)} />
      {movable ? (
        <Button
          ref={handleRef}
          id={`drag-job-${card.id}`}
          className="job-drag-handle icon-button"
          aria-label={`Move ${card.title} at ${card.company}`}
          title="Drag to another group. Keyboard: Space, arrow keys, Space to drop, Escape to cancel."
          disabled={disabled}
        >
          <GripVertical size={15} />
        </Button>
      ) : null}
    </div>
  );
}
