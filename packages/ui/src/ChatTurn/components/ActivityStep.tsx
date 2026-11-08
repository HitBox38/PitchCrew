import type { RunActivity } from '@pitchcrew/core';
import { activityPresentation, outcomes } from '../constants.ts';
import { Tool, ToolTrigger, ToolContent } from '@/components/ai-elements/tool/index.tsx';
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from '@/components/ai-elements/reasoning/index.tsx';
import { TraceLine, TraceIcon, TraceTitle, TraceDescription } from '@pitchcrew/design-system/trace';
import { TurnDuration } from './TurnDuration.tsx';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
/**
 * One step. A step blocked on the user (a browser request awaiting their OK, a page they hold)
 * reads as waiting: an ochre bead and no running timer, never a plum "working" spinner.
 */
export const ActivityStep = ({
  entry,
  waiting = false,
}: {
  entry: RunActivity;
  waiting?: boolean;
}) => {
  const { status } = activityPresentation[entry.status];
  const Root = entry.kind === 'reasoning' ? Reasoning : Tool;
  const Trigger = entry.kind === 'reasoning' ? ReasoningTrigger : ToolTrigger;
  const Content = entry.kind === 'reasoning' ? ReasoningContent : ToolContent;
  return (
    <Root className="chat-activity-step" data-status={entry.status}>
      <Trigger className="chat-activity-step-trigger">
        <TraceLine className="flex-1" status={status}>
          <TraceIcon>
            <StatusBead status={waiting ? 'waiting' : entry.status} />
          </TraceIcon>
          <TraceTitle className="flex-1 whitespace-normal">{entry.label}</TraceTitle>
          <span className="sr-only">{waiting ? 'Waiting for you' : outcomes[entry.status]}</span>
          <TraceDescription>
            {waiting ? null : (
              <TurnDuration
                startedAt={entry.startedAt}
                finishedAt={entry.finishedAt}
                active={entry.status === 'running'}
              />
            )}
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
};
