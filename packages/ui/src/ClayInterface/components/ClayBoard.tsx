import type { Card } from '@pitchcrew/core';
import type { ReactNode } from 'react';
import type { useBoardJobMutations } from '@/BoardPage/hooks/useBoardJobMutations.ts';
import { ClayPipeline } from './ClayPipeline.tsx';

type ClayBoardProps = {
  filtered: Card[];
  query: string;
  current: string;
  /** The phone stage selector, placed above the stage it shows. */
  stageSelect?: ReactNode;
  openCard: (id: string, section?: 'application') => void;
  jobMutations: ReturnType<typeof useBoardJobMutations>;
};

/** The pipeline as clay cards. */
export const ClayBoard = ({ stageSelect, ...pipeline }: ClayBoardProps) => (
  <div className="clay-board">
    {stageSelect}
    <ClayPipeline {...pipeline} />
  </div>
);
