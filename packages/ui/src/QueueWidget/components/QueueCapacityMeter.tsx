import type { WorkspaceQueue } from '@pitchcrew/core';
import { queueUtilization } from '../helpers.ts';

/** A fixed-size occupancy track, independent of the number of configured slots. */
export const QueueCapacityMeter = ({ queue }: { queue: WorkspaceQueue }) => (
  <span className="queue-capacity-meter" aria-hidden="true">
    <span style={{ width: `${queueUtilization(queue)}%` }} />
  </span>
);
