import { ReducedMotion } from '@/AppMotion/constants.ts';
import { useContext } from 'react';

export function useAppReducedMotion() {
  return useContext(ReducedMotion);
}
