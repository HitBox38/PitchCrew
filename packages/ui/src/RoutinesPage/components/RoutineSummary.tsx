import type { Routine } from '@pitchcrew/core';
import { nextRunSummary } from '../schedule-preview.ts';
import type { RoutineDraft } from '../types.ts';

/** The computed next run in the routine's timezone, plus what editing keeps. */
export const RoutineSummary = ({
  draft,
  initial,
  routine,
}: {
  draft: RoutineDraft;
  initial: RoutineDraft;
  routine: Routine | null;
}) => (
  <div className="ui-tray routine-summary" aria-live="polite">
    <p className="routine-summary-next">{nextRunSummary(draft, initial, routine)}</p>
    {routine ? (
      <p>
        {routine.runCount} {routine.runCount === 1 ? 'run' : 'runs'} already dispatched. Saving
        keeps this count, and run limits apply to the total.
      </p>
    ) : null}
    <p>
      Each run continues in the routine’s conversation. Exports and browser actions still need your
      approval.
    </p>
  </div>
);
