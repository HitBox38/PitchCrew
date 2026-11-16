import { z } from 'zod';

/** Declared DOM attributes are evidence, not proof of browser/server validation. */
const attributeEvidence = z.discriminatedUnion('status', [
  z.object({ status: z.literal('declared'), value: z.string().max(200) }).strict(),
  z.object({ status: z.enum(['absent', 'unavailable']) }).strict(),
]);

export const formControlEvidence = {
  // Missing evidence on historical records means unavailable, never absent or unlimited.
  constraints: z
    .object({
      minLength: attributeEvidence,
      maxLength: attributeEvidence,
      min: attributeEvidence,
      max: attributeEvidence,
      step: attributeEvidence,
      uploadSizeLimit: z.literal('unknown'),
    })
    .strict()
    .optional(),
  optionsTotal: z.number().int().nonnegative().optional(),
  optionsTruncated: z.boolean().optional(),
  group: z
    .object({
      role: z.enum(['fieldset', 'group', 'radiogroup']),
      label: z.string().max(500),
      required: z.boolean().nullable(),
    })
    .strict()
    .optional(),
};

const evidenceSchema = z.object(formControlEvidence);
export type FormControlEvidence = z.infer<typeof evidenceSchema>;
