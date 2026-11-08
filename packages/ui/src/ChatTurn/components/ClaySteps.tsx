import type { RunActivity } from '@pitchcrew/core';
import { useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import { Trace } from '@pitchcrew/design-system/trace';
import { ActivityStep } from './ActivityStep.tsx';
import { blockedSteps } from '../activity-summary.ts';

// Long turns show their latest steps; earlier ones stay one click away.
const shown = 4;

/** A turn's steps listed inline under the agent, each with its outcome bead. */
export const ClaySteps = ({
  entries,
  blocked,
}: {
  entries: RunActivity[];
  /** The labels of browser calls waiting on the user, matched exactly (see blockedSteps). */
  blocked?: readonly string[];
}) => {
  const waiting = blockedSteps(entries, blocked);
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
        <ActivityStep key={entry.id} entry={entry} waiting={waiting.has(entry.id)} />
      ))}
    </Trace>
  );
};
