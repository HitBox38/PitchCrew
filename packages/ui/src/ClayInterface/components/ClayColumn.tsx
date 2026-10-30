import type { Card, Role } from '@pitchcrew/core';
import type { BoardStage } from '@/board-stages.ts';
import { stateTone } from '../helpers.ts';
import type { JobSignal } from '../signals.ts';
import { ClayJobCard } from './ClayJobCard.tsx';

type ClayColumnProps = {
  stage: BoardStage;
  cards: Card[];
  signals: Map<string, JobSignal>;
  roles: Role[];
  onOpen: (id: string) => void;
};

const visible = 20;

export const ClayColumn = ({ stage, cards, signals, roles, onOpen }: ClayColumnProps) => (
  <section className="clay-column" aria-label={`${stage.label}, ${cards.length}`}>
    <header className="clay-column-heading">
      <span>{stage.label}</span>
      <span className="clay-column-count">{cards.length}</span>
      <span className="clay-column-beads" aria-hidden="true">
        {cards.slice(0, 8).map((card) => (
          <span
            key={card.id}
            className="clay-bead"
            data-size="sm"
            data-tone={signals.get(card.id)?.decision ? 'ochre' : stateTone(card.state)}
            data-live={signals.get(card.id)?.run ? '' : undefined}
          />
        ))}
      </span>
    </header>
    {cards.length ? (
      cards
        .slice(0, visible)
        .map((card) => (
          <ClayJobCard
            key={card.id}
            card={card}
            signal={signals.get(card.id) ?? {}}
            roles={roles}
            onOpen={onOpen}
          />
        ))
    ) : (
      <p className="clay-column-empty">{stage.empty}</p>
    )}
    {cards.length > visible ? (
      <p className="clay-column-more">{cards.length - visible} more. Search to find them.</p>
    ) : null}
  </section>
);
