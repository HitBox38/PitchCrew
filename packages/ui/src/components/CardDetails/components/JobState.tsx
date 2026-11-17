import type { JobStateProps } from '@/components/CardDetails/types.ts';

/**
 * Both ratings share one 0–100 form: "Fit 82 · Packet match 74". The progress row names a closed
 * job's status, and work in progress is said once, in the dock.
 */
export const JobState = ({ card }: JobStateProps) => {
  const scored = typeof card.fit === 'number';
  if (!scored && !card.packetFit) return null;
  return (
    <div className="detail-state">
      {scored ? (
        <span title="Candidate fit, 0–100. Not a hiring chance.">
          Fit <strong>{card.fit}</strong>
        </span>
      ) : null}
      {card.packetFit ? (
        <span title="Packet match rating, 0–100: how well this exact packet answers the brief.">
          Packet match <strong>{card.packetFit.score}</strong>
        </span>
      ) : null}
    </div>
  );
};
