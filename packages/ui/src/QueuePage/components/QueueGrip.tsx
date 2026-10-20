import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button/index.tsx';

export function QueueGrip({
  group,
  id,
  disabled,
  first,
  last,
  up,
  down,
}: {
  group: string;
  id: string;
  disabled: boolean;
  first: boolean;
  last: boolean;
  up: () => void;
  down: () => void;
}) {
  return (
    <div className="queue-grip">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Drag to reorder, or use arrow keys"
        disabled={disabled}
        draggable={!disabled}
        onDragStart={(event) => {
          event.stopPropagation();
          event.dataTransfer.setData(
            'application/x-pitchcrew-queue',
            JSON.stringify({ group, id }),
          );
          event.dataTransfer.effectAllowed = 'move';
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' && !first) {
            event.preventDefault();
            up();
          }
          if (event.key === 'ArrowDown' && !last) {
            event.preventDefault();
            down();
          }
        }}
      >
        <GripVertical size={16} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Move up"
        disabled={disabled || first}
        onClick={up}
      >
        <ChevronUp size={13} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Move down"
        disabled={disabled || last}
        onClick={down}
      >
        <ChevronDown size={13} />
      </Button>
    </div>
  );
}
