import { ArrowRight, ChevronDown } from 'lucide-react';
import type { ConversationWelcomeProps } from '@/ChatView/types.ts';
import { Collapsible } from '@/components/ui/collapsible/components/Collapsible.tsx';
import { CollapsibleContent } from '@/components/ui/collapsible/components/CollapsibleContent.tsx';
import { CollapsibleTrigger } from '@/components/ui/collapsible/components/CollapsibleTrigger.tsx';
import { welcomeLine, welcomeStarters } from '../starters.ts';

type Starter = { label: string; prompt: string };

const StarterRow = ({ starter, apply }: { starter: Starter; apply: (prompt: string) => void }) => (
  <button type="button" className="chat-starter" onClick={() => apply(starter.prompt)}>
    <span>{starter.label}</span>
    <ArrowRight size={15} aria-hidden="true" />
  </button>
);

/** An empty conversation: one purpose line and a few quiet starters just above the composer. */
export const ConversationWelcome = (props: ConversationWelcomeProps) => {
  const { applyStarter, readOnly } = props;
  const starters = readOnly ? [] : welcomeStarters(props);
  // Three starters stay in view; any others fold behind one quiet toggle.
  const shown = starters.slice(0, 3);
  const more = starters.slice(shown.length);
  return (
    <div className="chat-empty">
      <p className="chat-empty-purpose">{welcomeLine(props)}</p>
      {shown.length ? (
        <fieldset className="chat-starters" aria-label="Conversation starters">
          {shown.map((starter) => (
            <StarterRow key={starter.label} starter={starter} apply={applyStarter} />
          ))}
          {more.length ? (
            <Collapsible className="chat-starters-more">
              <CollapsibleTrigger className="chat-starters-toggle">
                {more.length} more {more.length === 1 ? 'starter' : 'starters'}
                <ChevronDown size={14} aria-hidden="true" />
              </CollapsibleTrigger>
              <CollapsibleContent className="chat-starters">
                {more.map((starter) => (
                  <StarterRow key={starter.label} starter={starter} apply={applyStarter} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </fieldset>
      ) : null}
    </div>
  );
};
