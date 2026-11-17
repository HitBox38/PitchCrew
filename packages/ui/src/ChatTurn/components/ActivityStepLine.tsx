import type { RunActivity } from '@pitchcrew/core';
import { TraceDescription, TraceIcon, TraceLine, TraceTitle } from '@pitchcrew/design-system/trace';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import { activityPresentation, outcomes, stepIcons } from '../constants.ts';
import { codeTarget, stepGlyph } from '../helpers.ts';
import { TurnDuration } from './TurnDuration.tsx';

/**
 * A step's one line: its outcome bead, a muted kind glyph, the verb-first label, the public target
 * (one line in the reading face, or the code face for a runtime's literal input; the full text is
 * in its tooltip and the step's details) and the duration.
 */
export const ActivityStepLine = ({ entry, waiting }: { entry: RunActivity; waiting: boolean }) => {
  const Icon = stepIcons[stepGlyph(entry)];
  return (
    <TraceLine className="flex-1" status={activityPresentation[entry.status].status}>
      <TraceIcon>
        <StatusBead status={waiting ? 'waiting' : entry.status} />
      </TraceIcon>
      {/* Before the title, where the primitive's offset for an icon after a title never applies. */}
      <TraceIcon className="chat-activity-step-kind">
        <Icon className="size-3.5" />
      </TraceIcon>
      {/* The label keeps its words; a target with no room beside it moves below it, as it always
       * does on touch and narrow screens. Its own direction, so right-to-left text keeps its start. */}
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        <TraceTitle className="max-w-full shrink-0 whitespace-normal">{entry.label}</TraceTitle>
        {entry.detail ? (
          <span
            className="chat-activity-step-detail"
            title={entry.detail}
            dir="auto"
            data-code={codeTarget(entry) || undefined}
          >
            {entry.detail}
          </span>
        ) : null}
      </span>
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
  );
};
