import { TrackingEvidence, TrackingProposal } from '@/TrackingReview/index.tsx';
import { deskScope } from '../../../constants.ts';
import { useDeskTools } from '../../../hooks/useDeskTools.ts';
import type { BodyProps } from '../../../types.ts';
import { OpenHeader } from './OpenHeader.tsx';

/**
 * A tracking review in the desk's order: the proposed change, the email's evidence (sender,
 * subject, time, quotation and the fetched email), who matched it, then the application choice,
 * Apply update, Reject and Refresh comparison, and what approving does under them, all from the
 * existing review. The row is already a raised surface, so the review drops its own heading and box.
 */
export const TrackingBody = ({ item, data, armedAt }: BodyProps) => {
  const { act } = useDeskTools();
  const signal = data.trackingSignals?.find((entry) => entry.id === item.entityId);
  if (!signal) return null;
  return (
    <>
      <OpenHeader item={item} data={data}>
        <TrackingEvidence signal={signal} />
      </OpenHeader>
      {signal.candidateIds.length ? null : (
        <p className="needs-note">Register an external application first if it is missing.</p>
      )}
      <TrackingProposal
        signal={signal}
        cards={data.cards}
        headless
        action={act({ item, data })}
        shortcut={deskScope}
        armedAt={armedAt}
      />
    </>
  );
};
