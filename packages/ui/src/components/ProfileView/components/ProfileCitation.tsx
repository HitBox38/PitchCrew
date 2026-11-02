import type { CardState } from '@pitchcrew/core';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { stateLabels } from '@/lib/labels.ts';
import { quoteRange } from '../layout.ts';

export interface CitationRow {
  id: string;
  company: string;
  state: string;
  quotes: string[];
  sameAs: string;
}

/** A quoted line: selecting it finds the line in the editor; a line the draft lost says so. */
const CitedLine = ({
  quote,
  content,
  reveal,
}: {
  quote: string;
  content: string;
  reveal: (quote: string) => void;
}) => {
  if (!quoteRange(content, quote))
    return (
      <span className="profile-citation-quote" data-missing="">
        <q>{quote}</q>
        <small>Not in the current draft</small>
      </span>
    );
  return (
    <button
      type="button"
      className="profile-citation-quote"
      title="Select this line in the editor"
      onClick={() => reveal(quote)}
    >
      <q>{quote}</q>
    </button>
  );
};

/** One packet: company and stage, its first quoted line, and the rest on demand. */
export const ProfileCitation = ({
  card,
  content,
  reveal,
}: {
  card: CitationRow;
  content: string;
  reveal: (quote: string) => void;
}) => {
  const openCard = useWorkspaceStore((state) => state.openCard);
  const more = card.sameAs ? [] : card.quotes.slice(1);
  return (
    <li className="profile-citation">
      <button
        type="button"
        className="profile-citation-open"
        onClick={() => openCard(card.id, 'application')}
      >
        <b>{card.company}</b>
        <span>{stateLabels[card.state as CardState] ?? card.state}</span>
      </button>
      {card.sameAs ? (
        <span className="profile-citation-same">Same lines as {card.sameAs}</span>
      ) : (
        <CitedLine quote={card.quotes[0]} content={content} reveal={reveal} />
      )}
      {more.length ? (
        <Collapsible className="profile-citation-rest">
          <CollapsibleTrigger className="profile-citation-more">
            {more.length} more {more.length === 1 ? 'quote' : 'quotes'}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="profile-citation-quotes">
              {more.map((quote) => (
                <li key={quote}>
                  <CitedLine quote={quote} content={content} reveal={reveal} />
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </li>
  );
};
