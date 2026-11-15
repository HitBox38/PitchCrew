import type { Card } from '@pitchcrew/core';

export interface JobCardProps {
  card: Card;
  /** Still while any job is dragged, so layout and tilt never fight the drag transform. */
  stationary?: boolean;
}
