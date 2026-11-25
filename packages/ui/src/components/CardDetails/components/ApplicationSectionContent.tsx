import type { ApplicationSection, CardDetailsModel } from '../types.ts';
import { ApplicationBriefReview } from '@/ApplicationBriefReview/index.tsx';
import { jobNextAction } from '../next-action.ts';
import { ApplicationDocuments } from './ApplicationDocuments.tsx';
import { ReviewsSection } from './ReviewsSection.tsx';
import { ExportRequest } from './ExportRequest.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { packetNeedsReview } from '../helpers.ts';

// What the dock already offers for the brief, so the brief column needn't repeat it.
const dockOffers = (model: CardDetailsModel) => {
  const next = jobNextAction(model);
  const intents = [next, ...(next.alternates ?? [])].map((action) => action.intent);
  return { extract: intents.includes('extract-brief'), write: intents.includes('write-brief') };
};

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
  if (section === 'brief')
    return (
      <ApplicationBriefReview
        card={card}
        model={brief}
        comparing={model.comparing}
        onCompare={model.setComparing}
        onEditJob={model.editBlocker ? undefined : () => model.setEditing(true)}
        dockOffers={dockOffers(model)}
      />
    );
  if (section === 'documents') return <ApplicationDocuments model={model} />;
  if (section === 'reviews') return <ReviewsSection model={model} reviewOpened={reviewOpened} />;
  if (card.state === 'agreed' && !packetNeedsReview(card))
    return (
      <ExportRequest
        choices={model.exportChoices}
        working={busy}
        footer={jobNextAction(model).perform === model.exportChoices.request}
      />
    );
  return (
    <>
      <p className="quiet">
        {model.exported
          ? 'Exported. Apply from Home, then record your submission after you apply.'
          : card.state === 'awaiting_approval'
            ? 'Your exact documents are waiting for your approval on Home.'
            : 'Available once the packet is reviewed.'}
      </p>
      {card.state === 'awaiting_approval' && !model.exported ? (
        <Button variant="outline" onClick={model.openPacket}>
          Open on Home
        </Button>
      ) : null}
    </>
  );
};
