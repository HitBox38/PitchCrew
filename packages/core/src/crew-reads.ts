import { z } from 'zod';

export const readFieldQuery = z.object({
  field: z
    .string()
    .max(160)
    .regex(/^[a-zA-Z]\w*(?:\.(?:[a-zA-Z]\w*|\d+))*$/)
    .optional()
    .describe('Field path, e.g. applicationContext.requirements.0.question.'),
  cursor: z
    .string()
    .regex(/^[\da-f]{64}:\d{1,12}$/)
    .optional()
    .describe('Use nextCursor with the same field to continue a long value.'),
});
