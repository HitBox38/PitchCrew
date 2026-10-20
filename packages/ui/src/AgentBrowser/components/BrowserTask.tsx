import { Button } from '@/components/ui/button/components/Button.tsx';
import { ArrowUpRight } from 'lucide-react';
import type { AgentBrowserProps } from '../types.ts';
export const BrowserTask = ({
  browserPanel,
  data,
  onThread,
  onOpenCard,
}: Pick<AgentBrowserProps, 'browserPanel' | 'data' | 'onThread' | 'onOpenCard'>) => {
  const session = browserPanel.session;
  const card = data.cards.find((item) => item.id === session?.cardId);
  const conversation = data.conversations?.find((item) => item.id === session?.threadId);
  if (!session) return null;
  return (
    <div className="mt-3 grid min-w-0 gap-1">
      <p className="m-0 text-xs text-muted-foreground">
        {card ? 'Job' : conversation ? 'Conversation' : 'Task'}
      </p>
      {card ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto justify-start p-0 text-left text-sm leading-5 whitespace-normal"
          onClick={() => onOpenCard(card.id)}
        >
          <span className="min-w-0 break-words">
            {card.company} · {card.title}
          </span>
          <ArrowUpRight size={12} aria-hidden="true" />
        </Button>
      ) : conversation ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto justify-start p-0 text-left text-sm leading-5 whitespace-normal"
          onClick={() => onThread(conversation.id)}
        >
          <span className="min-w-0 break-words">{conversation.title}</span>
          <ArrowUpRight size={12} aria-hidden="true" />
        </Button>
      ) : (
        <span className="text-sm">Manual browsing</span>
      )}
      {session?.runId ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Task permissions</span>
          <span title="Captured for this task. Composer changes apply to future turns.">
            {session.mode === 'autonomous' ? 'Autonomous preparation' : 'Supervised'}
          </span>
        </div>
      ) : null}
    </div>
  );
};
