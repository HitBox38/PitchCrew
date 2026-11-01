import type { JobStateProps } from '@/components/CardDetails/types.ts';
import { JobWorkStatus } from '@/components/JobWorkStatus/index.tsx';

/** `quietState` drops the status pill when a stage track beside it already names the stage. */
export const JobState = ({ card, quietState }: JobStateProps & { quietState?: boolean }) => {
  return (
    <div className="detail-state">
      <JobWorkStatus card={card} quietState={quietState} />
      {card.fit !== null ? <strong>{card.fit}% fit</strong> : null}
      {card.packetFit ? <strong>{card.packetFit.score}/100 packet match</strong> : null}
    </div>
  );
};
