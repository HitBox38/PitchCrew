import { createContext, useContext, type ReactNode } from 'react';
import { LazyMotion, MotionConfig, domMax, useReducedMotion } from 'motion/react';

export const claySpring = { type: 'spring', stiffness: 420, damping: 32 } as const;
export const surfaceSpring = { type: 'spring', stiffness: 320, damping: 30 } as const;
const ReducedMotion = createContext(true);

export function AppMotion({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <ReducedMotion value={reduced ?? true}>
      <MotionConfig reducedMotion="user" transition={surfaceSpring}>
        <LazyMotion features={domMax} strict>
          {children}
        </LazyMotion>
      </MotionConfig>
    </ReducedMotion>
  );
}

// Pointer-driven motion values also need the preference; MotionConfig handles declarative motion.
export function useAppReducedMotion() {
  return useContext(ReducedMotion);
}
