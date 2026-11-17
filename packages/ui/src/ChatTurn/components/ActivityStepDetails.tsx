import type { RunActivity } from '@pitchcrew/core';
import { Copy } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { TraceCollapsibleContent } from '@pitchcrew/design-system/trace';
import { copyText } from '@/lib/clipboard.ts';
import { outcomes } from '../constants.ts';
import { codeTarget } from '../helpers.ts';

/**
 * What a step's line cannot hold: its outcome, start time and whole target, with a copy action for
 * its reason. The reason itself stays on the step's own line, which shows it whole while open.
 */
export const ActivityStepDetails = ({ entry, reason }: { entry: RunActivity; reason?: string }) => (
  <TraceCollapsibleContent className="chat-activity-step-details">
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
    {entry.detail ? (
      <p
        className="chat-activity-step-target"
        dir="auto"
        data-code={codeTarget(entry) || undefined}
      >
        {entry.detail}
      </p>
    ) : null}
    {reason ? (
      <Button
        variant="ghost"
        size="sm"
        className="chat-activity-step-copy"
        onClick={() => copyText(reason, 'Reason copied')}
      >
        <Copy size={13} aria-hidden="true" /> Copy reason
      </Button>
    ) : null}
    {entry.kind === 'reasoning' ? <p>Thinking text is kept private.</p> : null}
  </TraceCollapsibleContent>
);
