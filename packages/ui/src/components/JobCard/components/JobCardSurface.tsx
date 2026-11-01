import { useJobCard } from '../hooks/useJobCard.ts';
import type { JobCardProps } from '../types.ts';
import type { ReactNode } from 'react';
import * as m from 'motion/react-m';

/**
 * The Motion surface a board job card and its menu button share: layout moves between columns and
 * a pointer tilt of at most 1°. Hover lift lives in CSS; drag transforms stay on the parent.
 */
export const JobCardSurface = ({ children, ...props }: JobCardProps & { children: ReactNode }) => {
  const { card, reduced, stationary, tiltX, tiltY, rotateX, rotateY } = useJobCard(props);
  return (
    <m.div
      className="job-card-surface relative"
      layout={stationary ? false : 'position'}
      layoutId={stationary ? undefined : `job-${card.id}`}
      initial={false}
      style={{
        rotateX: reduced ? 0 : rotateX,
        rotateY: reduced ? 0 : rotateY,
        transformPerspective: 900,
      }}
      onPointerMove={(event) => {
        if (
          reduced ||
          event.pointerType !== 'mouse' ||
          !event.currentTarget.contains(event.target as Node)
        )
          return;
        const rect = event.currentTarget.getBoundingClientRect();
        tiltX.set((0.5 - (event.clientY - rect.top) / rect.height) * 2);
        tiltY.set(((event.clientX - rect.left) / rect.width - 0.5) * 2);
      }}
      onPointerLeave={() => {
        tiltX.set(0);
        tiltY.set(0);
      }}
    >
      {children}
    </m.div>
  );
};
