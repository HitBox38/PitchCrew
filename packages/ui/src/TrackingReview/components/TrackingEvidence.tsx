import type { TrackingSignal } from '@pitchcrew/core';
import { sinceLabel, useClock } from '@/lib/time.ts';
import { TrackingSource } from '@/TrackingSource/index.tsx';

/**
 * What one email shows before anything is decided: its sender, subject and when it arrived (a clock
 * time with a day word once it is not today, as Home writes times), the fetched email, and why it
 * matched.
 */
export const TrackingEvidence = ({ signal }: { signal: TrackingSignal }) => {
  const now = useClock() * 30_000;
  return (
    <>
      <p className="quiet">
        {signal.from} · {signal.subject} · {sinceLabel(Date.parse(signal.effectiveAt), now)}
      </p>
      <TrackingSource signal={signal} />
      <p>{signal.reason}</p>
    </>
  );
};
