import type { ReactNode } from 'react';
import { m } from 'motion/react';
import { QueueGrip } from './QueueGrip.tsx';
import { useQueueOrder } from '../hooks/useQueueOrder.ts';
import type { QueueMoves } from '../types.ts';

/** An ordered list with drag, arrow-key and menu reordering; Make next jumps to the top. */
export const QueueList = <T extends { id: string }>({
  items,
  group,
  commit,
  render,
  className = '',
  movable = () => true,
}: {
  items: T[];
  group: string;
  commit: (id: string, beforeId: string | null) => Promise<unknown>;
  render: (item: T, handle: ReactNode, moves: QueueMoves) => ReactNode;
  className?: string;
  movable?: (item: T) => boolean;
}) => {
  const model = useQueueOrder(items, commit);
  // An active request stays at the head and is never a destination: the daemon rejects it.
  const head = model.visible.findIndex(movable);
  return (
    <ol className={`queue-list ${className}`} aria-label={group}>
      {model.visible.map((item, index) => {
        const disabled = model.busy || !movable(item);
        const move = (beforeId: string | null) => () => void model.move(item.id, beforeId);
        const first = model.visible[head];
        const moves: QueueMoves = disabled
          ? {}
          : {
              up: index > head ? move(model.visible[index - 1]?.id ?? null) : undefined,
              down:
                index < model.visible.length - 1
                  ? move(model.visible[index + 2]?.id ?? null)
                  : undefined,
              makeNext: index > head && first ? move(first.id) : undefined,
            };
        const handle = <QueueGrip group={group} id={item.id} disabled={disabled} moves={moves} />;
        return (
          <m.li
            key={item.id}
            layout="position"
            className="queue-list-item"
            onDragOver={(event) => {
              if (!disabled) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              try {
                const data = JSON.parse(
                  event.dataTransfer.getData('application/x-pitchcrew-queue'),
                );
                if (data.group === group && !disabled) void model.move(data.id, item.id);
              } catch {
                /* Unrelated drag. */
              }
            }}
          >
            {render(item, handle, moves)}
          </m.li>
        );
      })}
    </ol>
  );
};
