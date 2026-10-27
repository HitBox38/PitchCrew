import { z } from 'zod';
import type { Card } from './cards.ts';

const text = z.string().max(2000);
export const applicationFormSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('manual') }).strict(),
  z
    .object({
      status: z.literal('inspected'),
      url: text,
      fields: z
        .array(
          z
            .object({
              label: text,
              type: z.string().max(100),
              required: z.boolean(),
              visible: z.boolean(),
              disabled: z.boolean(),
              accept: text,
              options: z.array(text).max(100),
              maxLength: z.number().int().nonnegative().optional(),
              assessed: z.boolean(),
              condition: text,
              missingAnswer: text,
            })
            .strict(),
        )
        .max(1000),
      blockers: z.array(text).max(30),
      uninspected: z.array(text).max(100),
    })
    .strict(),
]);
export type ApplicationForm = z.infer<typeof applicationFormSchema>;

export const formHasQuestion = (form: ApplicationForm | undefined, question: string) =>
  form?.status === 'inspected' &&
  Boolean(question.trim()) &&
  form.fields.filter(
    (field) =>
      field.label === question &&
      field.visible &&
      !field.disabled &&
      field.assessed &&
      !['file', 'hidden', 'password', 'submit', 'reset', 'button'].includes(field.type),
  ).length === 1;

/** Only requirement metadata. Never forward browser text, HTML, selectors or entered values. */
export const inspectedApplicationForm = (
  card: Pick<Card, 'formAssessments'>,
): ApplicationForm | undefined => {
  const assessment = card.formAssessments?.at(-1);
  if (!assessment) return undefined;
  return applicationFormSchema.parse({
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
};

export const applicationFormIsCurrent = (card: Card) => {
  const form = card.applicationContext?.form;
  if (!form) return !card.url && !card.formAssessments?.length;
  return form.status === 'manual'
    ? !card.formAssessments?.length
    : JSON.stringify(requirementData(form)) ===
        JSON.stringify(requirementData(inspectedApplicationForm(card)));
};

// Resolving an answer is preparation progress, not a changed employer requirement.
const requirementData = (form: ApplicationForm | undefined) =>
  form?.status === 'inspected'
    ? { ...form, fields: form.fields.map(({ missingAnswer: _missingAnswer, ...field }) => field) }
    : form;
