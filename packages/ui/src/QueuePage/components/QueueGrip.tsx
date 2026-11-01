import { GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button/index.tsx';
import type { QueueMoves } from '../types.ts';

/** The one reorder affordance: drag it, or focus it and use the arrow keys. */
export const QueueGrip = ({
  group,
  id,
  disabled,
  moves,
}: {
  group: string;
  id: string;
  disabled: boolean;
  moves: QueueMoves;
}) => (
  <Button
    variant="ghost"
    size="icon"
    className="queue-grip"
    aria-label="Drag to reorder, or use arrow keys"
    disabled={disabled}
    draggable={!disabled}
    onDragStart={(event) => {
      event.stopPropagation();
      event.dataTransfer.setData('application/x-pitchcrew-queue', JSON.stringify({ group, id }));
      event.dataTransfer.effectAllowed = 'move';
    }}
    onKeyDown={(event) => {
      const move =
        event.key === 'ArrowUp' ? moves.up : event.key === 'ArrowDown' ? moves.down : null;
      if (!move) return;
      event.preventDefault();
      move();
    }}
  >
    <GripVertical size={16} aria-hidden="true" />
  </Button>
);
