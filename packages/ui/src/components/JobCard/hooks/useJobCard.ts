import { claySpring } from '@/AppMotion/constants.ts';
import { useAppReducedMotion } from '@/AppMotion/hooks/useAppReducedMotion.ts';
import type { JobCardProps } from '@/components/JobCard/types.ts';
import { useMotionValue, useSpring } from 'motion/react';

export function useJobCard({ card, onOpen }: JobCardProps) {
  const reduced = useAppReducedMotion();
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const rotateX = useSpring(tiltX, claySpring);
  const rotateY = useSpring(tiltY, claySpring);
  return { card, onOpen, reduced, tiltX, tiltY, rotateX, rotateY };
}
