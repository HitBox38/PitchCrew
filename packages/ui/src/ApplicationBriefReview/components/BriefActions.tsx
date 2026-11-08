import { AccordionSection } from '@pitchcrew/design-system/accordion';
import { ExtractionControls } from './ExtractionControls.tsx';
import type { useApplicationBrief } from '../hooks/useApplicationBrief.ts';
import type { Card } from '@pitchcrew/core';

const purpose =
  'An agent reads the saved posting and prepares a brief for your review. Review and confirm it before drafting.';

/** Extraction leads while no brief exists; afterwards re-extraction is an advanced option. */
export const BriefActions = ({
  model,
  card,
}: {
  model: ReturnType<typeof useApplicationBrief>;
  card: Card;
}) => {
  const first = !model.loaded?.context;
  if (!model.available.length)
    return (
      <p className="quiet">
        {first ? 'Automatic extraction needs an agent. ' : ''}Enable Codex, Claude Code or OpenCode
        in Crew to extract or draft. You can prepare a brief manually.
      </p>
    );
  if (first)
    return (
      <section className="grid gap-2" aria-label="Extract brief from posting">
        <h4>Extract the brief from the posting</h4>
        <p className="quiet">{purpose} Or prepare it yourself below.</p>
        <ExtractionControls model={model} card={card} label="Extract from source" />
      </section>
    );
  return (
    <AccordionSection heading="Extract again from source">
      <div className="grid gap-2 py-3">
        <p className="quiet">Runs extraction again on the saved posting. {purpose}</p>
        <ExtractionControls model={model} card={card} label="Extract again" />
      </div>
    </AccordionSection>
  );
};
