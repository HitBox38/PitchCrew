import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button/index.tsx';
import type { Decision } from '../signals.ts';

type DeckActionsProps = {
  decision: Decision;
  count: number;
  later: () => void;
  openCard: (id: string, section?: 'application') => void;
};

/**
 * One clay way to act on the decision (Add job stays the Board's only glaze); Later only moves it
 * behind the others, it never defers it.
 */
export const DeckActions = ({ decision, count, later, openCard }: DeckActionsProps) => (
  <div className="clay-deck-actions">
    {decision.kind === 'brief' && decision.cardId ? (
      <Button size="sm" variant="outline" onClick={() => openCard(decision.cardId!, 'application')}>
        Confirm brief
      </Button>
    ) : decision.kind === 'question' && decision.threadId ? (
      <Button
        size="sm"
        variant="outline"
        render={<Link to="/chat/$thread" params={{ thread: decision.threadId }} />}
      >
        Answer
      </Button>
    ) : (
      <Button
        size="sm"
        variant="outline"
        render={<Link to="/inbox" search={{ decision: decision.id }} />}
      >
        Review
      </Button>
    )}
    {count > 1 ? (
      <Button size="sm" variant="secondary" onClick={later}>
        Later
      </Button>
    ) : null}
  </div>
);
