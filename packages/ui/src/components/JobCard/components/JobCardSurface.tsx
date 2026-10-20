import { useJobCard } from '../hooks/useJobCard.ts';
import type { JobCardProps } from '../types.ts';
import type { ReactNode } from 'react';
import * as m from 'motion/react-m';

export const JobCardSurface = ({ children, ...props }: JobCardProps & { children: ReactNode }) => {
  const { card, reduced, stationary, tiltX, tiltY, rotateX, rotateY } = useJobCard(props);
  return (
    <m.div
      className="job-card-surface relative"
      layout={stationary ? false : 'position'}
      layoutId={stationary ? undefined : `job-${card.id}`}
      initial={reduced ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: reduced ? 1 : 0.97 }}
      whileHover={reduced ? undefined : { y: -4 }}
      whileTap={reduced ? undefined : { y: 0, scale: 0.985 }}
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
        tiltX.set((0.5 - (event.clientY - rect.top) / rect.height) * 4);
        tiltY.set(((event.clientX - rect.left) / rect.width - 0.5) * 4);
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
