import type { JobStateProps } from '@/components/CardDetails/types.ts';
import { stateLabels } from '@/lib/labels.ts';

export function JobState({ card }: JobStateProps) {
  return (
    <div className="detail-state">
      <span className={`state-pill ${card.state}`}>{stateLabels[card.state]}</span>
      {card.fit !== null ? <strong>{card.fit}% fit</strong> : null}
    </div>
  );
}
