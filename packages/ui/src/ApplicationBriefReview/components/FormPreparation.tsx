import { Button } from '@/components/ui/button/components/Button.tsx';
import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';
import { FormSelect } from '@/FormSelect/index.tsx';
import { FormRequirements } from './FormRequirements.tsx';
import type { useApplicationBrief } from '../hooks/useApplicationBrief.ts';
import type { Card } from '@pitchcrew/core';

export const FormPreparation = ({
  model,
  card,
}: {
  model: ReturnType<typeof useApplicationBrief>;
  card: Card;
}) => {
  return (
    <section className="grid gap-3" aria-label="Application form inspection">
      <h4>Application form</h4>
      <FormRequirements form={model.draft.form} />
      {card.url ? (
        <div className="flex flex-wrap items-end gap-2">
          {model.formAgents.length ? (
            <FormSelect
              label="Form inspection agent"
              value={model.formRoleId}
              onValueChange={model.setFormRoleId}
              options={model.formAgents.map((role) => ({ value: role.id, label: role.name }))}
            />
          ) : (
            <p className="quiet">Enable an agent with browser and form assessment tools in Crew.</p>
          )}
          <Button
            variant="outline"
            disabled={model.disabled || model.editing || !model.formRoleId}
            onClick={() => {
              void model.inspectForm();
            }}
          >
            Inspect application form
          </Button>
        </div>
      ) : (
        <p className="quiet">
          Add an application link to inspect its fields and file requirements.
        </p>
      )}
      {model.editing && !model.loaded?.form && card.url ? (
        <label className="flex items-start gap-2">
          <Checkbox
            checked={model.draft.form?.status === 'manual'}
            disabled={model.disabled}
            onCheckedChange={(checked) =>
              model.setDraft({ ...model.draft, form: checked ? { status: 'manual' } : undefined })
            }
          />
          I’ll check the form’s required fields and files myself. Continue with an uninspected
          packet.
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
