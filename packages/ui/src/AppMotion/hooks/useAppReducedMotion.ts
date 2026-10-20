import { ReducedMotion } from '@/AppMotion/constants.ts';
import { useContext } from 'react';

export const useAppReducedMotion = () => {
  return useContext(ReducedMotion);
};
