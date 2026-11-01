import type { Card, Snapshot } from '@pitchcrew/core';
import type { ReactNode } from 'react';
import type { useBoardJobMutations } from '@/BoardPage/hooks/useBoardJobMutations.ts';
import { ClayPipeline } from './ClayPipeline.tsx';
import { DecisionDeck } from './DecisionDeck.tsx';

type ClayBoardProps = {
  data: Snapshot;
  filtered: Card[];
  query: string;
  current: string;
  setup?: ReactNode;
  /** The phone stage selector, placed between the deck strip and the stage it shows. */
  stageSelect?: ReactNode;
  openCard: (id: string, section?: 'application') => void;
  jobMutations: ReturnType<typeof useBoardJobMutations>;
};

/** The Board: decisions first, then the pipeline as clay cards. */
export const ClayBoard = ({ data, setup, stageSelect, openCard, ...pipeline }: ClayBoardProps) => (
  <div className="clay-board">
    <DecisionDeck data={data} openCard={openCard} setup={setup} />
    {stageSelect}
    <ClayPipeline openCard={openCard} {...pipeline} />
  </div>
);
