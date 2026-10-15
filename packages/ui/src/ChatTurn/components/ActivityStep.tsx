import type { RunActivity } from '@pitchcrew/core';
import { Check, CircleDashed, LoaderCircle, X } from 'lucide-react';
import { Tool, ToolTrigger, ToolContent } from '@/components/ai-elements/tool/index.tsx';
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from '@/components/ai-elements/reasoning/index.tsx';
import { TraceLine } from '@/components/ui/trace/components/TraceLine.tsx';
import { TraceIcon } from '@/components/ui/trace/components/TraceIcon.tsx';
import { TraceTitle } from '@/components/ui/trace/components/TraceTitle.tsx';
import { TraceDescription } from '@/components/ui/trace/components/TraceDescription.tsx';
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
  const Root = entry.kind === 'reasoning' ? Reasoning : Tool;
  const Trigger = entry.kind === 'reasoning' ? ReasoningTrigger : ToolTrigger;
  const Content = entry.kind === 'reasoning' ? ReasoningContent : ToolContent;
  return (
    <Root className="chat-activity-step" data-status={entry.status}>
      <Trigger className="chat-activity-step-trigger">
        <TraceLine
          className="flex-1"
          status={
            entry.status === 'running'
              ? 'running'
              : entry.status === 'failed'
                ? 'error'
                : entry.status === 'interrupted'
                  ? 'pending'
                  : undefined
          }
        >
          <TraceIcon>
            <Icon className={entry.status === 'running' ? 'spin' : undefined} />
          </TraceIcon>
          <TraceTitle className="flex-1 whitespace-normal">{entry.label}</TraceTitle>
          <span className="sr-only">{outcomes[entry.status]}</span>
          <TraceDescription>
            <TurnDuration
              startedAt={entry.startedAt}
              finishedAt={entry.finishedAt}
              active={entry.status === 'running'}
            />
          </TraceDescription>
        </TraceLine>
      </Trigger>
      <Content className="chat-activity-step-details">
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
      </Content>
    </Root>
  );
}
