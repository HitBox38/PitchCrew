import type { ApplicationForm } from './application-form.ts';

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
