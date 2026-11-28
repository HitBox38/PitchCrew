import { z } from 'zod';
import { formChoiceIsCurrent, inspectedFormRequirements } from './form-requirements.ts';
import type { FormAssessment } from './submissions.ts';
import type { Card } from './cards.ts';
import { formControlEvidence } from './form-constraints.ts';

const text = z.string().max(2000);
const inspectedFormSchema = z
  .object({
    status: z.literal('inspected'),
    url: text,
    fields: z
      .array(
        z
          .object({
            ...formControlEvidence,
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
  .strict();
export const applicationFormSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('manual') }).strict(),
  inspectedFormSchema,
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

const validatedRequirements = (assessment: FormAssessment) =>
  inspectedFormSchema.parse(inspectedFormRequirements(assessment));

export const inspectedApplicationForm = (
  card: Pick<Card, 'formAssessments'>,
): ApplicationForm | undefined => {
  const latest = card.formAssessments?.at(-1);
  return latest && validatedRequirements(latest);
};

export const applicationFormIsCurrent = (card: Card) =>
  formChoiceIsCurrent(card, validatedRequirements);
