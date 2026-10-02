import { ReducedMotion, surfaceSpring } from '@/AppMotion/constants.ts';
import type { AppMotionProps } from '@/AppMotion/types.ts';
import { LazyMotion, MotionConfig, domMax, useReducedMotion } from 'motion/react';

export function AppMotion({ children }: AppMotionProps) {
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
