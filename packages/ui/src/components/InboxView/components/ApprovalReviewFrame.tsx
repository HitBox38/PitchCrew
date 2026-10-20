import type { ReactNode } from 'react';
import { useIsPresent } from 'motion/react';
import { useAppReducedMotion } from '@/AppMotion/hooks/useAppReducedMotion.ts';
import * as m from 'motion/react-m';

export const ApprovalReviewFrame = ({
  children,
  actions,
}: {
  children: ReactNode;
  actions: ReactNode;
}) => {
  const reduced = useAppReducedMotion();
  const present = useIsPresent();
  return (
    <m.section
      className="approval-card inbox-review-card"
      inert={!present}
      layout={reduced ? false : 'position'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, pointerEvents: 'none' }}
      transition={{ duration: 0.16 }}
    >
      <div className="inbox-review-content">{children}</div>
      {actions ? <div className="inbox-review-actions">{actions}</div> : null}
    </m.section>
  );
};
