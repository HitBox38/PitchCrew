import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button/index.tsx';
import type { Decision } from '../signals.ts';

type DeckActionsProps = {
  decision: Decision;
  count: number;
  later: () => void;
  openCard: (id: string, section?: 'application') => void;
};

export const DeckActions = ({ decision, count, later, openCard }: DeckActionsProps) => (
  <div className="clay-deck-actions">
    {decision.kind === 'brief' && decision.cardId ? (
      <Button onClick={() => openCard(decision.cardId!, 'application')}>Confirm brief</Button>
    ) : decision.kind === 'question' && decision.threadId ? (
      <Button render={<Link to="/chat/$thread" params={{ thread: decision.threadId }} />}>
        Answer
      </Button>
    ) : (
      <Button render={<Link to="/inbox" />}>Review</Button>
    )}
    {count > 1 ? (
      <Button variant="secondary" onClick={later}>
        Later
      </Button>
    ) : null}
  </div>
);
