import type { WorkspaceQueue } from '@pitchcrew/core';
import type { CSSProperties } from 'react';
import { traySockets } from '../helpers.ts';

/** All slots: a short toolbar strip or a bounded ten-column grid in the queue panel. */
export const QueueSlots = ({
  queue,
  layout = 'compact',
}: {
  queue: WorkspaceQueue;
  layout?: 'compact' | 'grid';
}) => {
  const sockets = traySockets(queue);
  const dense = sockets.length > 10;
  const columns =
    layout === 'grid'
      ? Math.min(10, sockets.length)
      : dense
        ? Math.ceil(sockets.length / 2)
        : sockets.length;
  return (
    <span
      className="queue-tray-sockets"
      data-layout={layout}
      data-dense={dense ? '' : undefined}
      style={{ '--queue-slot-columns': columns } as CSSProperties}
      aria-hidden="true"
    >
      {sockets.map((state, index) => (
        <span
          key={index}
          className="clay-bead"
          data-size="sm"
          data-slot-state={state}
          data-tone={state === 'free' ? undefined : 'plum'}
          data-empty={state === 'free' ? '' : undefined}
        />
      ))}
    </span>
  );
};
