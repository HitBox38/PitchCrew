import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import type { Snapshot } from '@pitchcrew/core';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { decisionTitle } from '../jobs.ts';
import { decisions } from '../signals.ts';
import { DeckCard } from './DeckCard.tsx';

type DecisionDeckProps = {
  data: Snapshot;
  openCard: (id: string, section?: 'application') => void;
  /** The Board setup checklist, shown at the top of the deck while setup is active. */
  setup?: ReactNode;
};

export const DecisionDeck = ({ data, openCard, setup }: DecisionDeckProps) => {
  const items = decisions(data);
  const [offset, setOffset] = useState(0);
  if (!items.length)
    return setup ? (
      <aside className="clay-deck" aria-label="Setup">
        {setup}
      </aside>
    ) : (
      <p className="clay-deck-clear">
        <Check aria-hidden="true" size={15} />
        Nothing needs your decision
      </p>
    );
  const start = offset % items.length;
  const [top, ...rest] = [...items.slice(start), ...items.slice(0, start)];
  return (
    <aside className="clay-deck" aria-label={`Needs you, ${items.length}`}>
      {setup}
      <header className="clay-deck-heading">
        <span>Needs you</span>
        <span className="clay-deck-count">
          {items.length} {items.length === 1 ? 'decision' : 'decisions'}
        </span>
        <span className="clay-pips" aria-label={`${start + 1} of ${items.length}`}>
          {items.slice(0, 5).map((item, index) => (
            <i key={item.id} data-current={index === Math.min(start, 4) ? '' : undefined} />
          ))}
        </span>
      </header>
      <div className="clay-deck-stack" data-depth={Math.min(rest.length, 2)}>
        <DeckCard
          decision={top!}
          data={data}
          count={items.length}
          later={() => setOffset(offset + 1)}
          openCard={openCard}
        />
      </div>
      {rest.length ? <p className="clay-deck-then">Then</p> : null}
      {rest.slice(0, 2).map((item, index) => (
        <button
          key={item.id}
          type="button"
          className="clay-deck-next"
          onClick={() => setOffset(offset + index + 1)}
        >
          {item.roleId ? <RoleAvatar agentRole={item.roleId} size="small" /> : null}
          <span>
            <strong>
              {data.cards.find((c) => c.id === item.cardId)?.company ?? 'Conversation'}
            </strong>
            <span>{decisionTitle(item, data)}</span>
          </span>
        </button>
      ))}
    </aside>
  );
};
