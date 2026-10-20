import type { ReactNode } from 'react';
import { m } from 'motion/react';
import { QueueGrip } from './QueueGrip.tsx';
import { useQueueOrder } from '../hooks/useQueueOrder.ts';

export function QueueList<T extends { id: string }>({
  items,
  group,
  commit,
  render,
  movable = () => true,
}: {
  items: T[];
  group: string;
  commit: (id: string, beforeId: string | null) => Promise<unknown>;
  render: (item: T, handle: ReactNode) => ReactNode;
  movable?: (item: T) => boolean;
}) {
  const model = useQueueOrder(items, commit);
  return (
    <ol className="queue-list" aria-label={group}>
      {model.visible.map((item, index) => {
        const disabled = model.busy || !movable(item);
        const up = () => void model.move(item.id, model.visible[index - 1]?.id ?? null);
        const down = () => void model.move(item.id, model.visible[index + 2]?.id ?? null);
        const handle = (
          <QueueGrip
            group={group}
            id={item.id}
            disabled={disabled}
            first={index === 0}
            last={index === items.length - 1}
            up={up}
            down={down}
          />
        );
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
            {render(item, handle)}
          </m.li>
        );
      })}
    </ol>
  );
}
