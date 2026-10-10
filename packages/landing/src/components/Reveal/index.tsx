'use client';

import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        className={className}
        initial={false}
        whileInView={{
          opacity: [0.85, 1],
          transform: reduced !== false ? 'none' : ['translateY(8px)', 'translateY(0)'],
        }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
