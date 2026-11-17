import { useId } from 'react';
import type { RunActivity } from '@pitchcrew/core';
import { TraceCollapsible, TraceCollapsibleTrigger } from '@pitchcrew/design-system/trace';
import { stepReason } from '../helpers.ts';
import { ActivityStepDetails } from './ActivityStepDetails.tsx';
import { ActivityStepLine } from './ActivityStepLine.tsx';

/**
 * One step. A step blocked on the user (a browser request awaiting their OK, a page they hold)
 * reads as waiting: an ochre bead and no running timer, never a plum "working" spinner. A failed
 * step says why below its line, outside the button so its name stays short and so the reason
 * also shows in the collapsed turn: quiet history in plain text, never an alert. Two lines until
 * the step opens, when the same line shows it all in place.
 */
export const ActivityStep = ({
  entry,
  waiting = false,
}: {
  entry: RunActivity;
  waiting?: boolean;
}) => {
  const reasonId = useId();
  const reason = stepReason(entry, waiting);
  return (
    <TraceCollapsible className="chat-activity-step" data-status={entry.status}>
      <TraceCollapsibleTrigger
        className="chat-activity-step-trigger"
        aria-describedby={reason ? reasonId : undefined}
      >
        <ActivityStepLine entry={entry} waiting={waiting} />
      </TraceCollapsibleTrigger>
      {reason ? (
        <p id={reasonId} className="chat-activity-step-reason" dir="auto" title={reason}>
          {reason}
        </p>
      ) : null}
      <ActivityStepDetails entry={entry} reason={reason} />
    </TraceCollapsible>
  );
};
