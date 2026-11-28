import type { ApplicationForm } from './application-form.ts';
import type { Card } from './cards.ts';
import type { FormAssessment } from './submissions.ts';

type InspectedForm = Extract<ApplicationForm, { status: 'inspected' }>;

/** Select only the requirement metadata that can be saved in the brief. */
export const inspectedFormRequirements = (assessment: FormAssessment): InspectedForm => ({
  status: 'inspected',
  url: assessment.page.url,
  fields: assessment.fields.map((field) => ({
    label: field.label,
    type: field.type,
    required: field.required,
    visible: field.visible,
    disabled: field.disabled,
    accept: field.accept,
    options: field.options,
    ...(field.maxLength === undefined ? {} : { maxLength: field.maxLength }),
    ...(field.buttonType === undefined ? {} : { buttonType: field.buttonType }),
    ...(field.constraints === undefined ? {} : { constraints: field.constraints }),
    ...(field.optionsTotal === undefined ? {} : { optionsTotal: field.optionsTotal }),
    ...(field.optionsTruncated === undefined ? {} : { optionsTruncated: field.optionsTruncated }),
    ...(field.group === undefined ? {} : { group: field.group }),
    assessed: field.assessed,
    condition: field.condition,
    missingAnswer: field.missingAnswer,
  })),
  blockers: assessment.blockers,
  uninspected: [
    ...assessment.uninspected,
    ...(!assessment.fields.length ? ['No application controls were inspected.'] : []),
  ],
});

// Field and option order carry meaning. Object key order and answer progress do not.
const requirementKey = (form: InspectedForm) =>
  JSON.stringify(form, (key, value: unknown) => {
    if (key === 'missingAnswer') return undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((name) => [name, record[name]]),
    );
  });

export const formChoiceIsCurrent = (
  card: Card,
  readRequirements: (assessment: FormAssessment) => InspectedForm = inspectedFormRequirements,
) => {
  const adopted = card.applicationContext?.form;
  if (!adopted) return !card.url && !card.formAssessments?.length;
  if (adopted.status === 'manual') return !card.formAssessments?.length;
  const latest = card.formAssessments?.at(-1);
  return !!latest && requirementKey(adopted) === requirementKey(readRequirements(latest));
};
