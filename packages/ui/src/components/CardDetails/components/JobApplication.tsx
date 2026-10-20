import { useState } from 'react';
import type { CardDetailsModel, ApplicationSection } from '../types.ts';
import { ApplicationSectionContent } from './ApplicationSectionContent.tsx';
import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import { FormAssessments } from './FormAssessments.tsx';
import { Accordion } from '@/components/ui/accordion/components/Accordion.tsx';
import { AccordionItem } from '@/components/ui/accordion/components/AccordionItem.tsx';
import { AccordionTrigger } from '@/components/ui/accordion/components/AccordionTrigger.tsx';
import { AccordionContent } from '@/components/ui/accordion/components/AccordionContent.tsx';
import { packetNeedsReview } from '../helpers.ts';

export function JobApplication(model: CardDetailsModel) {
  const { card, brief, sections, setSections } = model;
  const [reviewOpened, setReviewOpened] = useState(false);
  if (!reviewOpened && sections.includes('reviews')) setReviewOpened(true);
  const rows: { id: ApplicationSection; title: string; status: string }[] = [
    {
      id: 'brief',
      title: 'Brief and requirements',
      status: brief.confirmed ? 'Confirmed' : 'Needs review',
    },
    {
      id: 'documents',
      title: 'Documents',
      status: card.packet ? 'Draft available' : 'Not drafted',
    },
    {
      id: 'reviews',
      title: 'Reviews',
      status: card.packetReview && !packetNeedsReview(card) ? 'Reviewed' : 'Review needed',
    },
    {
      id: 'export',
      title: 'Export',
      status: model.exported
        ? 'Exported'
        : card.state === 'awaiting_approval'
          ? 'Approval requested'
          : 'Not exported',
    },
  ];
  return (
    <div className="detail-application space-y-4">
      {!brief.confirmed ? (
        <p className="quiet">
          Confirm the complete job brief before an agent drafts your application.
        </p>
      ) : null}
      {packetNeedsReview(card) ? (
        <output className="form-error">
          This packet needs a review against the current confirmed brief before export or
          submission.
        </output>
      ) : null}
      <Accordion
        className="detail-application-sections"
        value={sections}
        onValueChange={(value) => {
          setSections(value as ApplicationSection[]);
          if (value.includes('reviews')) setReviewOpened(true);
        }}
      >
        {rows.map((row) => (
          <AccordionItem value={row.id} key={row.id}>
            <AccordionTrigger id={`job-section-${row.id}`}>
              <span>
                {row.title}
                <small className="detail-section-status">{row.status}</small>
              </span>
            </AccordionTrigger>
            <AccordionContent keepMounted className="detail-section-body">
              <ApplicationSectionContent
                model={model}
                section={row.id}
                reviewOpened={reviewOpened}
              />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      {card.formAssessments?.length ? (
        <AccordionSection
          heading="Inspected application form"
          key={card.formAssessments.at(-1)?.createdAt}
          defaultOpen={Boolean(
            card.formAssessments.at(-1)?.blockers.length ||
            card.formAssessments.at(-1)?.fields.some((field) => field.missingAnswer),
          )}
        >
          <FormAssessments card={card} />
        </AccordionSection>
      ) : null}
    </div>
  );
}
