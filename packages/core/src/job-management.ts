import { z } from 'zod';
import { states } from './states.ts';

export const maxJobBatchSize = 100;
export const bulkDeleteJobsInput = z
  .object({
    cardIds: z
      .array(z.uuid())
      .min(1)
      .max(maxJobBatchSize)
      .refine((ids) => new Set(ids).size === ids.length, 'Choose each job only once.'),
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();
export const bulkMoveJobsInput = bulkDeleteJobsInput.extend({ state: z.enum(states) });
