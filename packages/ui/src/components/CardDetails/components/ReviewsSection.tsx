import { keyedItems } from '@/lib/list-keys.ts';
import { ReviewLaunch } from '@/DeepResumeReview/components/ReviewLaunch.tsx';
import { DeepResumeReview } from '@/DeepResumeReview/index.tsx';
import { HandoffSummary } from '@/components/InboxView/components/PacketHandoff.tsx';
import { cardHandoff } from '@/components/InboxView/handoff.ts';
import { DetectorChecks } from '@/DetectorChecks/index.tsx';
import { packetNeedsReview } from '../helpers.ts';
import type { CardDetailsModel } from '../types.ts';

/**
 * Reviews: what Reviewer asked for (when it requested changes), its summary and the Writer's
 * notes, detector checks, then the optional deep review and its reports.
 */
export const ReviewsSection = ({
  model,
  reviewOpened,
}: {
  model: CardDetailsModel;
  reviewOpened: boolean;
}) => {
  const { card, brief, busy } = model;
  return (
    <div className="space-y-5">
      {card.state === 'changes_requested' && card.feedback.length ? (
        <section className="detail-requested" aria-label="Requested changes">
          <h3>Reviewer asked for</h3>
          <ul className="feedback">
            {keyedItems(card.feedback, (note) => note).map(({ item: note, key }) => (
              <li key={key}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {packetNeedsReview(card) ? null : <HandoffSummary handoff={cardHandoff(card, model.data)} />}
      <DetectorChecks card={card} />
      <section className="deep-review-block" aria-label="Deep review">
        <div className="deep-review-head">
          <h3>Deep review</h3>
          <ReviewLaunch
            card={card}
            data={model.data}
            working={busy}
            disabled={!brief.confirmed}
            act={model.act}
          />
        </div>
        <p className="quiet">
          Seven hiring perspectives on the resume, supported corrections and a full packet recheck.
        </p>
        {reviewOpened ? <DeepResumeReview card={card} data={model.data} /> : null}
      </section>
    </div>
  );
};
