import type { ApplicationForm } from './application-form.ts';
import type { Card } from './cards.ts';
import type { FormAssessment } from './submissions.ts';

type InspectedForm = Extract<ApplicationForm, { status: 'inspected' }>;
type DeclaredConstraints = NonNullable<InspectedForm['fields'][number]['constraints']>;
const attributeKey = (attribute: DeclaredConstraints['maxLength']) =>
  attribute.status === 'declared' ? [attribute.status, attribute.value] : attribute.status;

/**
 * Employer requirement metadata in a fixed key order, without `missingAnswer`: resolving an answer
 * is preparation progress. The renderer and daemon use this same comparison.
 */
export const formRequirementKey = (form: Omit<InspectedForm, 'status'>) =>
  JSON.stringify([
    form.url,
    form.fields.map((field) => [
      field.label,
      field.type,
      field.required,
      field.visible,
      field.disabled,
      field.accept,
      field.options,
      field.maxLength,
      field.buttonType,
      field.optionsTotal,
      field.optionsTruncated,
      field.constraints && [
        attributeKey(field.constraints.minLength),
        attributeKey(field.constraints.maxLength),
        attributeKey(field.constraints.min),
        attributeKey(field.constraints.max),
        attributeKey(field.constraints.step),
        field.constraints.uploadSizeLimit,
      ],
      field.group && [field.group.role, field.group.label, field.group.required],
      field.assessed,
      field.condition,
    ]),
    form.blockers,
    form.uninspected,
  ]);

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

export const formChoiceIsCurrent = (
  card: Card,
  readRequirements: (assessment: FormAssessment) => InspectedForm = inspectedFormRequirements,
) => {
  const adopted = card.applicationContext?.form;
  if (!adopted) return !card.url && !card.formAssessments?.length;
  if (adopted.status === 'manual') return !card.formAssessments?.length;
  const latest = card.formAssessments?.at(-1);
  return !!latest && formRequirementKey(adopted) === formRequirementKey(readRequirements(latest));
};
