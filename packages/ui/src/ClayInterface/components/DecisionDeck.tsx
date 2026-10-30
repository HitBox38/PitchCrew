import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Snapshot } from '@pitchcrew/core';
import { decisionTitle } from '../jobs.ts';
import { decisions } from '../signals.ts';
import { DeckActions } from './DeckActions.tsx';

type DecisionDeckProps = {
  data: Snapshot;
  openCard: (id: string, section?: 'application') => void;
};

export const DecisionDeck = ({ data, openCard }: DecisionDeckProps) => {
  const items = decisions(data);
  const [offset, setOffset] = useState(0);
  if (!items.length)
    return (
      <aside className="clay-deck" data-clear="" aria-label="Needs you">
        <p className="clay-deck-clear">
          <Check aria-hidden="true" size={16} />
          Nothing needs you. The crew will ask here when it does.
        </p>
      </aside>
    );
  const start = offset % items.length;
  const ordered = [...items.slice(start), ...items.slice(0, start)];
  const [top, ...rest] = ordered;
  if (!top) return null;
  const card = data.cards.find((item) => item.id === top.cardId);
  return (
    <aside className="clay-deck" aria-label={`Needs you, ${items.length}`}>
      <header className="clay-deck-heading">
        <span>Needs you</span>
        <span className="clay-column-count">{items.length}</span>
        <span className="clay-pips" aria-label={`${start + 1} of ${items.length}`}>
          {items.slice(0, 6).map((item, index) => (
            <i key={item.id} data-current={index === start ? '' : undefined} />
          ))}
        </span>
      </header>
      <div className="clay-deck-stack" data-depth={Math.min(rest.length, 2)}>
        <article className="clay-deck-card">
          <h3>{decisionTitle(top, data)}</h3>
          {card ? (
            <p className="clay-deck-job">
              {card.title} · {card.company}
              {card.fit !== null ? ` · Fit ${card.fit}` : ''}
            </p>
          ) : null}
          {top.kind === 'question' || top.kind === 'browser' ? (
            <p className="clay-deck-detail">{top.detail}</p>
          ) : null}
          <DeckActions
            decision={top}
            count={items.length}
            later={() => setOffset(offset + 1)}
            openCard={openCard}
          />
        </article>
      </div>
      {rest.length ? <p className="clay-deck-then">Then</p> : null}
      {rest.slice(0, 3).map((item, index) => (
        <button
          key={item.id}
          type="button"
          className="clay-deck-next"
          onClick={() => setOffset(offset + index + 1)}
        >
          <strong>{data.cards.find((c) => c.id === item.cardId)?.company ?? 'Conversation'}</strong>
          <span>{decisionTitle(item, data)}</span>
        </button>
      ))}
    </aside>
  );
};
