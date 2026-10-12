import type { RunActivity } from '@pitchcrew/core';
import { Check, ChevronRight, CircleDashed, LoaderCircle, X } from 'lucide-react';
import { Collapsible } from '@/components/ui/collapsible/components/Collapsible.tsx';
import { CollapsibleContent } from '@/components/ui/collapsible/components/CollapsibleContent.tsx';
import { CollapsibleTrigger } from '@/components/ui/collapsible/components/CollapsibleTrigger.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { TurnDuration } from './TurnDuration.tsx';

const outcomes = {
  running: 'In progress',
  completed: 'Finished',
  failed: 'Tool failed',
  interrupted: 'Outcome unavailable',
};
export function ActivityStep({ entry }: { entry: RunActivity }) {
  const Icon =
    entry.status === 'running'
      ? LoaderCircle
      : entry.status === 'failed'
        ? X
        : entry.status === 'interrupted'
          ? CircleDashed
          : Check;
  return (
    <Collapsible className="chat-activity-step" data-status={entry.status}>
      <CollapsibleTrigger
        render={<Button variant="ghost" className="chat-activity-step-trigger" />}
      >
        <Icon
          size={13}
          className={entry.status === 'running' ? 'spin' : undefined}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 text-left">{entry.label}</span>
        <span className="sr-only">{outcomes[entry.status]}</span>
        <TurnDuration
          startedAt={entry.startedAt}
          finishedAt={entry.finishedAt}
          active={entry.status === 'running'}
        />
        <ChevronRight size={12} className="chat-activity-chevron shrink-0" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent className="chat-activity-step-details">
        <p>{outcomes[entry.status]}</p>
        <p>
          Started{' '}
          <time dateTime={entry.startedAt}>
            {new Date(entry.startedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </time>
        </p>
        {entry.kind === 'reasoning' ? <p>Thinking text is kept private.</p> : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
