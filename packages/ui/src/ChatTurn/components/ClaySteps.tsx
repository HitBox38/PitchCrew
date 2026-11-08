import type { RunActivity } from '@pitchcrew/core';
import { useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import { Trace } from '@pitchcrew/design-system/trace';
import { ActivityStep } from './ActivityStep.tsx';
import { blockedStep } from '../activity-summary.ts';

// Long turns show their latest steps; earlier ones stay one click away.
const shown = 4;

/** A turn's steps listed inline under the agent, each with its outcome bead. */
export const ClaySteps = ({
  entries,
  blocked,
}: {
  entries: RunActivity[];
  /**
   * The label of the browser call blocked on the user's OK. The gateway names that call with the
   * request's own public summary, so the step is matched exactly, never guessed from order.
   */
  blocked?: string;
}) => {
  const waitingId = blockedStep(entries, blocked);
  const [all, setAll] = useState(false);
  const hidden = all ? 0 : Math.max(0, entries.length - shown);
  return (
    <Trace className="clay-steps">
      {hidden ? (
        <Button variant="ghost" size="xs" className="clay-steps-more" onClick={() => setAll(true)}>
          Show {hidden} earlier {hidden === 1 ? 'step' : 'steps'} ›
        </Button>
      ) : null}
      {entries.slice(hidden).map((entry) => (
        <ActivityStep key={entry.id} entry={entry} waiting={entry.id === waitingId} />
      ))}
    </Trace>
  );
};
