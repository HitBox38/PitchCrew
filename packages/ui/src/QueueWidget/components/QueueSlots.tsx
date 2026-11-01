import type { WorkspaceQueue } from '@pitchcrew/core';
import { traySockets } from '../helpers.ts';

/** Up to five sockets: plum for an occupied workspace slot, an empty socket when free. */
export const QueueSlots = ({ queue }: { queue: WorkspaceQueue }) => (
  <span className="queue-tray-sockets" aria-hidden="true">
    {traySockets(queue).map((state, index) => (
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
