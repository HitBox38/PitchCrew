import type { ApplicationSection, CardDetailsModel } from '../types.ts';
import { ApplicationBriefReview } from '@/ApplicationBriefReview/index.tsx';
import { ReviewLaunch } from '@/DeepResumeReview/components/ReviewLaunch.tsx';
import { DeepResumeReview } from '@/DeepResumeReview/index.tsx';
import { JobPacket } from './JobPacket.tsx';
import { ExportRequest } from './ExportRequest.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { packetNeedsReview } from '../helpers.ts';

export const ApplicationSectionContent = ({
  model,
  section,
  reviewOpened,
}: {
  model: CardDetailsModel;
  section: ApplicationSection;
  reviewOpened: boolean;
}) => {
  const { card, brief, busy } = model;
  if (section === 'brief') return <ApplicationBriefReview card={card} model={brief} />;
  if (section === 'documents')
    return (
      <div className="space-y-3">
        <Button variant="link" onClick={model.openWriting}>
          Writing guide
        </Button>
        {card.packet ? (
          <JobPacket {...model} />
        ) : (
          <p className="quiet">
            {brief.confirmed
              ? 'Use Draft application below to prepare your documents.'
              : 'Review and confirm the brief, then draft your application.'}
          </p>
        )}
      </div>
    );
  if (section === 'reviews')
    return (
      <div className="space-y-5">
        <Button variant="link" onClick={model.openWriting}>
          Writing guide
        </Button>
        <ReviewLaunch
          card={card}
          data={model.data}
          working={busy}
          disabled={!brief.confirmed}
          act={model.act}
        />
        {reviewOpened ? <DeepResumeReview card={card} data={model.data} /> : null}
      </div>
    );
  if (card.state === 'agreed' && !packetNeedsReview(card))
    return <ExportRequest card={card} act={model.act} working={busy} />;
  return (
    <>
      <p className="quiet">
        {model.exported
          ? 'The current packet was exported. Record submission only after you have applied.'
          : card.state === 'awaiting_approval'
            ? 'Your exact documents are waiting for review in Inbox.'
            : 'Complete packet review before requesting export approval.'}
      </p>
      {card.state === 'awaiting_approval' && !model.exported ? (
        <Button onClick={model.openInbox}>Open approval inbox</Button>
      ) : null}
    </>
  );
};
