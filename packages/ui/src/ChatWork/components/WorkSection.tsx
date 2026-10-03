import { useAppReducedMotion } from '@/AppMotion/hooks/useAppReducedMotion.ts';
import * as m from 'motion/react-m';
import type { PropsWithChildren } from 'react';

export function WorkSection(props: PropsWithChildren<{ className?: string }>) {
  const reduced = useAppReducedMotion();
  return (
    <m.section layout={reduced ? false : 'position'} transition={{ duration: 0.2 }} {...props} />
  );
}
