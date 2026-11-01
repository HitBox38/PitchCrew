import type { Snapshot } from '@pitchcrew/core';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { timeAgo } from '@/lib/time.ts';
import { decisionSource, decisionTitle } from '../jobs.ts';
import type { Decision } from '../signals.ts';
import { DeckActions } from './DeckActions.tsx';
import { DeckEvidence } from './DeckEvidence.tsx';

type DeckCardProps = {
  decision: Decision;
  data: Snapshot;
  count: number;
  later: () => void;
  openCard: (id: string, section?: 'application') => void;
};

/** The decision on top of the deck: who asks and when, what it is, its evidence and one action. */
export const DeckCard = ({ decision, data, count, later, openCard }: DeckCardProps) => {
  const card = data.cards.find((item) => item.id === decision.cardId);
  const source = decisionSource(decision, data);
  return (
    <article
      className="clay-deck-card"
      data-kind={decision.kind}
      aria-label={decisionTitle(decision, data)}
    >
      <p className="clay-deck-source">
        {source.roleId ? <RoleAvatar agentRole={source.roleId} size="small" /> : null}
        <span>
          {source.text} · <time dateTime={decision.createdAt}>{timeAgo(decision.createdAt)}</time>
        </span>
      </p>
      <h3>{decisionTitle(decision, data)}</h3>
      {card ? (
        <p className="clay-deck-job">
          {decision.kind === 'question'
            ? `${card.company} · ${card.title}`
            : `${card.title}${decision.kind === 'packet' ? '' : ` · ${card.company}`}`}
          {card.fit !== null ? <span className="clay-deck-fit"> · Fit {card.fit}</span> : null}
        </p>
      ) : null}
      <DeckEvidence decision={decision} data={data} />
      <DeckActions decision={decision} count={count} later={later} openCard={openCard} />
    </article>
  );
};
