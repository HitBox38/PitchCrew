import type { RunActivity } from '@pitchcrew/core';
import { ChevronRight, Layers, LoaderCircle } from 'lucide-react';
import { Collapsible } from '@/components/ui/collapsible/components/Collapsible.tsx';
import { CollapsibleContent } from '@/components/ui/collapsible/components/CollapsibleContent.tsx';
import { CollapsibleTrigger } from '@/components/ui/collapsible/components/CollapsibleTrigger.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { ActivityStep } from './ActivityStep.tsx';

export function ActivityGroup({ entries }: { entries: RunActivity[] }) {
  const active = entries.findLast((entry) => entry.status === 'running');
  const tools = entries.filter((entry) => entry.kind === 'tool');
  const failures = tools.filter((entry) => entry.status === 'failed').length;
  const label = tools.length
    ? `${tools.length} ${tools.length === 1 ? 'step' : 'steps'}`
    : active
      ? 'Thinking'
      : 'Thought';
  return (
    <Collapsible className="chat-activity-group">
      <CollapsibleTrigger
        render={<Button variant="ghost" className="chat-activity-group-trigger" />}
      >
        {active ? (
          <LoaderCircle size={14} className="spin shrink-0" aria-hidden="true" />
        ) : (
          <Layers size={14} className="shrink-0" aria-hidden="true" />
        )}
        <span className="shrink-0">{label}</span>
        {active && tools.length ? (
          <span className="min-w-0 truncate text-muted-foreground">{active.label}</span>
        ) : null}
        {failures ? <span className="text-destructive">{failures} failed</span> : null}
        <ChevronRight
          size={13}
          className="chat-activity-chevron ml-auto shrink-0"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="chat-activity-group-content">
        {entries.map((entry) => (
          <ActivityStep key={entry.id} entry={entry} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
