import type { RunActivity } from '@pitchcrew/core';
import { useState } from 'react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Trace } from '@/components/ui/trace/components/Trace.tsx';
import { ActivityStep } from './ActivityStep.tsx';

// Long turns show their latest steps; earlier ones stay one click away.
const shown = 4;

/** A turn's steps listed inline under the agent, each with its outcome bead. */
export const ClaySteps = ({ entries }: { entries: RunActivity[] }) => {
  const [all, setAll] = useState(false);
  const hidden = all ? 0 : Math.max(0, entries.length - shown);
  return (
    <Trace className="clay-steps">
      {hidden ? (
        <Button variant="ghost" size="xs" className="clay-steps-more" onClick={() => setAll(true)}>
          {hidden} earlier {hidden === 1 ? 'step' : 'steps'}
        </Button>
      ) : null}
      {entries.slice(hidden).map((entry) => (
        <ActivityStep key={entry.id} entry={entry} />
      ))}
    </Trace>
  );
};
