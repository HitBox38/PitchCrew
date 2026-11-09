import { Button } from '@pitchcrew/design-system/button';
import { BriefActions } from './components/BriefActions.tsx';
import { ConfirmBrief } from './components/ConfirmBrief.tsx';
import { FlaggedSource } from './components/FlaggedSource.tsx';
import { BriefFields } from './components/BriefFields.tsx';
import { BriefSummary } from './components/BriefSummary.tsx';
import { RequirementFields } from './components/RequirementFields.tsx';
import { FormPreparation } from './components/FormPreparation.tsx';
import type { useApplicationBrief } from './hooks/useApplicationBrief.ts';
import type { Card } from '@pitchcrew/core';

export const ApplicationBriefReview = ({
  card,
  model,
}: {
  card: Card;
  model: ReturnType<typeof useApplicationBrief>;
}) => {
  const { draft, setDraft, loaded, editing, confirmed, disabled } = model;
  // Without a brief, the agent path leads; manual preparation stays one click away.
  const extractFirst = Boolean(loaded && !loaded.context && !editing);
  return (
    <section className="form grid gap-3" aria-label="Application brief review">
      <h3>Application brief</h3>
      {model.error ? (
        <p className="form-error" role="alert">
          {model.error}
        </p>
      ) : null}
      {confirmed && !editing ? (
        <p className="quiet">
          Confirmed for drafting. Changes need another confirmation and packet review.
        </p>
      ) : (
        <p className="quiet">
          Review the complete brief and employer requests against the original posting. Source
          visibility is unknown.
        </p>
      )}
      {loaded?.context && !editing && !confirmed ? <BriefSummary value={draft} /> : null}
      <FlaggedSource items={draft.flagged} />
      {extractFirst ? <BriefActions model={model} card={card} /> : null}
      <FormPreparation model={model} card={card} />
      {editing ? (
        <>
          <BriefFields value={draft.brief} change={(brief) => setDraft({ ...draft, brief })} />
          <RequirementFields
            value={draft.requirements}
            change={(requirements) => setDraft({ ...draft, requirements })}
          />
          <ConfirmBrief model={model} />
        </>
      ) : (
        <Button
          className="justify-self-start"
          variant="outline"
          disabled={disabled}
          onClick={() => model.setEditing(true)}
        >
          {loaded?.context ? 'Review or edit brief' : 'Prepare brief manually'}
        </Button>
      )}
      {loaded?.context ? <BriefActions model={model} card={card} /> : null}
    </section>
  );
};
