import { claySpring } from '@/AppMotion/constants.ts';
import { useIsPresent } from 'motion/react';
import * as m from 'motion/react-m';
import type { ReactNode } from 'react';

export function QuestionToaster({ children, reduced }: { children: ReactNode; reduced: boolean }) {
  const present = useIsPresent();
  const hidden = reduced ? 'translateY(0%)' : 'translateY(100%)';
  return (
    <m.section
      className="pending-user-questions"
      aria-label="Questions waiting for you"
      aria-hidden={present ? undefined : true}
      inert={!present}
    >
      <div className="pending-question-stage">
        <m.div
          className="pending-user-questions-lane"
          initial={{ transform: hidden, opacity: reduced ? 0 : 1 }}
          animate={{ transform: 'translateY(0%)', opacity: 1 }}
          exit={{ transform: hidden, opacity: reduced ? 0 : 1 }}
          transition={reduced ? { duration: 0.12 } : claySpring}
        >
          {children}
        </m.div>
      </div>
    </m.section>
  );
}
