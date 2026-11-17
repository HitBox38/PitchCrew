import { Button } from '@pitchcrew/design-system/button';
import { Checkbox } from '@pitchcrew/design-system/checkbox';
import { FormRequirements } from './FormRequirements.tsx';
import { FormInspect, InspectAgain } from './FormInspect.tsx';
import type { useApplicationBrief } from '../hooks/useApplicationBrief.ts';
import type { Card } from '@pitchcrew/core';

export const FormPreparation = ({
  model,
  card,
  onEditJob,
}: {
  model: ReturnType<typeof useApplicationBrief>;
  card: Card;
  onEditJob?: () => void;
}) => {
  const inspected = model.draft.form?.status === 'inspected';
  return (
    <section className="grid gap-3" aria-label="Application form inspection">
      <div className="-my-1 flex min-h-8 items-center justify-between gap-2">
        <h4>Application form</h4>
        {inspected && card.url && !model.editing ? <InspectAgain model={model} /> : null}
        {/* Without a link there is nothing to inspect; adding one is the job's own edit. */}
        {!card.url && onEditJob ? (
          <Button variant="ghost" size="sm" onClick={onEditJob}>
            Add application link
          </Button>
        ) : null}
      </div>
      {/* Without a link nothing can be inspected, so only the add-a-link line applies. */}
      {card.url || model.draft.form ? (
        <FormRequirements
          form={model.draft.form}
          checkedAt={card.formAssessments?.at(-1)?.createdAt}
          selectors={card.formAssessments?.at(-1)?.fields.map((field) => field.selector)}
          reviewing={model.editing}
        />
      ) : null}
      {card.url ? (
        inspected ? null : (
          <FormInspect model={model} />
        )
      ) : onEditJob ? null : (
        <p className="quiet">Add an application link to inspect its fields and files.</p>
      )}
      {model.editing && !model.loaded?.form && card.url ? (
        // `.form label` stacks children; `checkbox-label` keeps the box beside its wrapping text.
        <label className="checkbox-label min-h-8 items-start py-1 pointer-coarse:min-h-11">
          <Checkbox
            className="mt-0.5 shrink-0"
            checked={model.draft.form?.status === 'manual'}
            disabled={model.disabled}
            onCheckedChange={(checked) =>
              model.setDraft({ ...model.draft, form: checked ? { status: 'manual' } : undefined })
            }
          />
          <span className="min-w-0">
            I’ll check the form’s required fields and files myself. Continue with an uninspected
            packet.
          </span>
        </label>
      ) : null}
      {model.draft.form?.status === 'manual' ? (
        <p className="quiet">
          You chose to check the form yourself; packet review does not establish form readiness.
        </p>
      ) : null}
    </section>
  );
};
