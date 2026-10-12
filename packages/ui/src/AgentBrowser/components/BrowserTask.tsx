import { Button } from '@/components/ui/button/components/Button.tsx';
import type { AgentBrowserProps } from '../types.ts';
export function BrowserTask({
  browserPanel,
  data,
  onThread,
  onOpenCard,
}: Pick<AgentBrowserProps, 'browserPanel' | 'data' | 'onThread' | 'onOpenCard'>) {
  const session = browserPanel.session;
  const card = data.cards.find((item) => item.id === session?.cardId);
  const conversation = data.conversations?.find((item) => item.id === session?.threadId);
  return (
    <div className="browser-task">
      <span>{session?.runId ? 'Working on' : 'Last task'}</span>
      {card ? (
        <Button variant="link" size="sm" onClick={() => onOpenCard(card.id)}>
          {card.company} · {card.title}
        </Button>
      ) : conversation ? (
        <Button variant="link" size="sm" onClick={() => onThread(conversation.id)}>
          {conversation.title}
        </Button>
      ) : (
        <span>{session ? 'Manual browsing' : 'No browser opened yet'}</span>
      )}
      {session?.runId ? (
        <span className="badge">
          {session.mode === 'autonomous' ? 'Autonomous browsing' : 'Supervised'}
        </span>
      ) : null}
    </div>
  );
}
