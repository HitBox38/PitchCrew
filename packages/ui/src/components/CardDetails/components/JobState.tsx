import type { JobStateProps } from '@/components/CardDetails/types.ts';
import { JobWorkStatus } from '@/components/JobWorkStatus/index.tsx';

export const JobState = ({ card }: JobStateProps) => {
  return (
    <div className="detail-state">
      <JobWorkStatus card={card} />
      {card.fit !== null ? <strong>{card.fit}% fit</strong> : null}
    </div>
  );
};
