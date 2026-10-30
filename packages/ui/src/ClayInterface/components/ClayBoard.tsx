import type { Card, Snapshot } from '@pitchcrew/core';
import type { useBoardJobMutations } from '@/BoardPage/hooks/useBoardJobMutations.ts';
import { ClayPipeline } from './ClayPipeline.tsx';
import { DecisionDeck } from './DecisionDeck.tsx';

type ClayBoardProps = {
  data: Snapshot;
  filtered: Card[];
  openCard: (id: string, section?: 'application') => void;
  jobMutations: ReturnType<typeof useBoardJobMutations>;
};

/** Board for the clay preview: decisions first, then the pipeline as clay cards. */
export const ClayBoard = ({ data, filtered, openCard, jobMutations }: ClayBoardProps) => (
  <div className="clay-board">
    <DecisionDeck data={data} openCard={openCard} />
    <ClayPipeline filtered={filtered} openCard={openCard} jobMutations={jobMutations} />
  </div>
);
