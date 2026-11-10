import { z } from 'zod';
import { states } from './states.ts';
import { cardInput } from './cards.ts';

/** Full user form; agent corrections retain their narrower field allowlist below. */
export const editJobInput = cardInput
  .omit({ sourceHtml: true })
  .extend({ expectedUpdatedAt: z.iso.datetime() })
  .strict();

export const jobDetailsChanges = cardInput
  .pick({ company: true, title: true, location: true, salary: true })
  .extend({
    location: cardInput.shape.location.unwrap(),
    salary: cardInput.shape.salary.unwrap(),
  })
  .partial()
  .strict()
  .refine((changes) => Object.values(changes).some((value) => value !== undefined), {
    message: 'Supply at least one job detail to correct.',
  });
export const updateJobInput = z
  .object({
    cardId: z.uuid().optional(),
    changes: jobDetailsChanges,
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();

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
/** Chat Reviewer findings; limits match the isolated reviewer result. */
export const reviewFeedbackInput = z
  .object({
    feedback: z.array(z.string().trim().min(1).max(2000)).min(1).max(30),
    suggestions: z.array(z.string().trim().min(1).max(2000)).max(60).optional(),
  })
  .strict();
