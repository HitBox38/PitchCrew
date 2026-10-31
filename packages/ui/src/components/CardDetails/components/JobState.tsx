import type { JobStateProps } from '@/components/CardDetails/types.ts';
import { JobWorkStatus } from '@/components/JobWorkStatus/index.tsx';
import { useDevicePreferences } from '@/lib/device-preferences.ts';
import { trackIndex } from '@/ClayInterface/helpers.ts';

export const JobState = ({ card }: JobStateProps) => {
  // The clay stage track names the stage, so the matching pill would only repeat it.
  const tracked =
    useDevicePreferences((state) => state.clayInterface) && trackIndex(card.state) !== null;
  return (
    <div className="detail-state">
      <JobWorkStatus card={card} quietState={tracked} />
      {card.fit !== null ? <strong>{card.fit}% fit</strong> : null}
      {card.packetFit ? <strong>{card.packetFit.score}/100 packet match</strong> : null}
    </div>
  );
};
