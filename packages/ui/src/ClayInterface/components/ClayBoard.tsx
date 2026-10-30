import type { Card, Snapshot } from '@pitchcrew/core';
import { stages } from '@/board-stages.ts';
import { sortBoardCards } from '@/BoardPage/sorting.ts';
import { jobSignals } from '../signals.ts';
import { ClayColumn } from './ClayColumn.tsx';
import { DecisionDeck } from './DecisionDeck.tsx';

type ClayBoardProps = {
  data: Snapshot;
  filtered: Card[];
  openCard: (id: string, section?: 'application') => void;
};

/** Board for the clay preview: decisions first, then the pipeline as clay cards. */
export const ClayBoard = ({ data, filtered, openCard }: ClayBoardProps) => {
  const signals = jobSignals(data);
  return (
    <div className="clay-board">
      <DecisionDeck data={data} openCard={openCard} />
      <div className="clay-columns">
        {stages.map((stage) => (
          <ClayColumn
            key={stage.id}
            stage={stage}
            cards={sortBoardCards(
              filtered.filter((card) => stage.states.includes(card.state)),
              'fit-desc',
            )}
            signals={signals}
            roles={data.roles}
            onOpen={openCard}
          />
        ))}
      </div>
    </div>
  );
};
