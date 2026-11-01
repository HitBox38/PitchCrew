import type { CardState } from '@pitchcrew/core';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { stateLabels } from '@/lib/labels.ts';

interface CitationRow {
  id: string;
  company: string;
  state: string;
  quotes: string[];
  sameAs: string;
}

/** One packet: company and stage, its first quoted line, and the rest on demand. */
export const ProfileCitation = ({ card }: { card: CitationRow }) => {
  const openCard = useWorkspaceStore((state) => state.openCard);
  const more = card.sameAs ? [] : card.quotes.slice(1);
  return (
    <li className="profile-citation">
      <button
        type="button"
        className="profile-citation-open"
        onClick={() => openCard(card.id, 'application')}
      >
        <span className="profile-citation-job">
          <b>{card.company}</b>
          <span>{stateLabels[card.state as CardState] ?? card.state}</span>
        </span>
        {card.sameAs ? (
          <span className="profile-citation-same">Same lines as {card.sameAs}</span>
        ) : (
          <q className="profile-citation-quote" title={card.quotes[0]}>
            {card.quotes[0]}
          </q>
        )}
      </button>
      {more.length ? (
        <Collapsible className="profile-citation-rest">
          <CollapsibleTrigger className="profile-citation-more">
            {more.length} more {more.length === 1 ? 'quote' : 'quotes'}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="profile-citation-quotes">
              {more.map((quote) => (
                <li key={quote}>
                  <q>{quote}</q>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </li>
  );
};
