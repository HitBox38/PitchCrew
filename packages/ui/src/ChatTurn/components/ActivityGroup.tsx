import type { RunActivity } from '@pitchcrew/core';
import { Layers } from 'lucide-react';
import {
  ChainOfThought,
  ChainOfThoughtTrigger,
  ChainOfThoughtContent,
} from '@/components/ai-elements/chain-of-thought/index.tsx';
import { Trace } from '@/components/ui/trace/components/Trace.tsx';
import { TraceLine } from '@/components/ui/trace/components/TraceLine.tsx';
import { TraceIcon } from '@/components/ui/trace/components/TraceIcon.tsx';
import { TraceTitle } from '@/components/ui/trace/components/TraceTitle.tsx';
import { ActivityStep } from './ActivityStep.tsx';

export function ActivityGroup({
  entries,
  defaultOpen = false,
}: {
  entries: RunActivity[];
  defaultOpen?: boolean;
}) {
  const active = entries.findLast((entry) => entry.status === 'running');
  const tools = entries.filter((entry) => entry.kind === 'tool');
  const failures = tools.filter((entry) => entry.status === 'failed').length;
  const label = tools.length
    ? `${tools.length} ${tools.length === 1 ? 'step' : 'steps'}`
    : active
      ? 'Thinking'
      : 'Thought';
  return (
    <Trace>
      <ChainOfThought className="chat-activity-group" defaultOpen={defaultOpen}>
        <ChainOfThoughtTrigger className="chat-activity-group-trigger">
          <TraceLine status={active ? 'running' : failures ? 'error' : undefined}>
            <TraceIcon>
              <Layers />
            </TraceIcon>
            <TraceTitle>{label}</TraceTitle>
            {failures ? <span className="text-destructive">{failures} failed</span> : null}
          </TraceLine>
        </ChainOfThoughtTrigger>
        <ChainOfThoughtContent className="chat-activity-group-content">
          <Trace>
            {entries.map((entry) => (
              <ActivityStep key={entry.id} entry={entry} />
            ))}
          </Trace>
        </ChainOfThoughtContent>
      </ChainOfThought>
    </Trace>
  );
}
