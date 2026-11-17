import { Collapsible } from '@pitchcrew/design-system/collapsible';
import { BriefActions } from './components/BriefActions.tsx';
import { BriefTools } from './components/BriefTools.tsx';
import { CompareTrigger, OriginalPosting } from './components/OriginalPosting.tsx';
import { ConfirmBrief } from './components/ConfirmBrief.tsx';
import { FlaggedSource } from './components/FlaggedSource.tsx';
import { BriefFields } from './components/BriefFields.tsx';
import { BriefSummary } from './components/BriefSummary.tsx';
import { RequirementFields } from './components/RequirementFields.tsx';
import { FormPreparation } from './components/FormPreparation.tsx';
import type { useApplicationBrief } from './hooks/useApplicationBrief.ts';
import { briefIntro, revealComparison } from './helpers.ts';
import type { Card } from '@pitchcrew/core';

/**
 * Compare with posting puts the saved posting beside the brief (above it on narrow sheets), since
 * Pitchcrew cannot tell whether the posting it extracted from is complete.
 */
export const ApplicationBriefReview = ({
  card,
  model,
  comparing = false,
  onCompare,
  onEditJob,
  dockOffers,
}: {
  card: Card;
  model: ReturnType<typeof useApplicationBrief>;
  comparing?: boolean;
  onCompare?: (open: boolean) => void;
  /** Opens Edit job, where an application link can be added. */
  onEditJob?: () => void;
  /** Brief actions the dock already offers, so the column doesn't repeat them. */
  dockOffers?: { extract: boolean; write: boolean };
}) => {
  const { draft, setDraft, loaded, editing, confirmed } = model;
  // Without a brief, the agent path leads; manual preparation stays one click away.
  const extractFirst = Boolean(loaded && !loaded.context && !editing);
  const intro = briefIntro({ editing, confirmed, extracted: Boolean(loaded?.context) });
  // Comparing needs a brief (or one being written) to set beside the posting.
  const compare =
    onCompare && (loaded?.context || editing) ? <CompareTrigger comparing={comparing} /> : null;
  return (
    <Collapsible
      open={comparing}
      onOpenChange={(open, details) => {
        onCompare?.(open);
        if (open) revealComparison(details.event.target);
      }}
      className="brief-compare"
    >
      <OriginalPosting description={card.description} />
      <section className="brief-review form grid gap-3" aria-label="Application brief review">
        {/* The Application step row titles this section; the heading keeps it navigable. */}
        <h3 className="sr-only">Application brief</h3>
        {model.error ? (
          <p className="form-error" role="alert">
            {model.error}
          </p>
        ) : null}
        {intro ? (
          <div className="brief-intro">
            <p>{intro}</p>
            {compare}
          </div>
        ) : null}
        {loaded?.context && !editing ? <BriefSummary value={draft} /> : null}
        <FlaggedSource items={draft.flagged} />
        {extractFirst ? (
          <BriefActions model={model} card={card} dockExtracts={dockOffers?.extract} />
        ) : null}
        {editing ? (
          <>
            <BriefFields value={draft.brief} change={(brief) => setDraft({ ...draft, brief })} />
            <RequirementFields
              value={draft.requirements}
              change={(requirements) => setDraft({ ...draft, requirements })}
            />
          </>
        ) : null}
        {/* Brief, requirements, then the form: the order confirmation adopts them in. */}
        <FormPreparation model={model} card={card} onEditJob={onEditJob} />
        {editing ? (
          <ConfirmBrief model={model} />
        ) : (
          <BriefTools
            model={model}
            card={card}
            compare={intro ? null : compare}
            dockWrites={dockOffers?.write}
          />
        )}
        {loaded?.context && !model.available.length ? (
          <BriefActions model={model} card={card} />
        ) : null}
      </section>
    </Collapsible>
  );
};
