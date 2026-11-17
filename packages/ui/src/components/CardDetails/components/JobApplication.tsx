import { useState } from 'react';
import type { CardDetailsModel, ApplicationSection } from '../types.ts';
import { ApplicationSectionContent } from './ApplicationSectionContent.tsx';
import { PacketFit } from './PacketFit.tsx';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@pitchcrew/design-system/accordion';
import { applicationRows, liveApplicationSteps, runSection } from '../helpers.ts';
import { trackIndex } from '@/ClayInterface/helpers.ts';
import { jobWaitingKinds } from '@/ClayInterface/signals.ts';

/**
 * A ledger of the application's steps: one line each, the current step open by default and any
 * number open at once. Panels stay mounted, so drafts survive closing a step.
 */
export const JobApplication = (model: CardDetailsModel) => {
  const { card, brief, sections, setSections } = model;
  const [reviewOpened, setReviewOpened] = useState(false);
  if (!reviewOpened && sections.includes('reviews')) setReviewOpened(true);
  const rows = applicationRows(
    card,
    brief.confirmed,
    model.exported,
    brief.loaded ? !!brief.loaded.context : true,
  );
  const asking = model.agents.find((agent) => agent.run.status === 'waiting' && !agent.handedOff);
  const run = model.run;
  const working = run && model.agents.find((agent) => agent.run.id === run.id);
  // Work shows on the step it belongs to; fit and packet rating belong to none.
  const steps = liveApplicationSteps(
    rows,
    {
      asking: asking ? { name: asking.name, section: runSection(asking.run) } : undefined,
      working: run ? { name: working?.name ?? 'An agent', section: runSection(run) } : undefined,
    },
    { closed: trackIndex(card.state) === null, waiting: jobWaitingKinds(card.id, model.data) },
  );
  return (
    <div className="detail-application">
      <Accordion
        multiple
        className="detail-application-sections"
        data-steps=""
        value={sections}
        onValueChange={(value) => setSections(value as ApplicationSection[])}
      >
        {steps.map(({ row, bead, live }) => (
          <AccordionItem value={row.id} key={row.id}>
            <AccordionTrigger id={`job-section-${row.id}`}>
              <span
                className="clay-bead"
                data-size="sm"
                data-tone={bead}
                data-live={live ? '' : undefined}
                data-empty={bead ? undefined : ''}
                aria-hidden="true"
              />
              <span>
                {row.title} <small className="detail-section-status">{row.status}</small>
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
      {/* Rates the whole packet against the brief; reevaluation stays open after applying. */}
      {card.packet || card.packetFit ? <PacketFit model={model} /> : null}
    </div>
  );
};
