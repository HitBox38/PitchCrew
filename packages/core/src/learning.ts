import { z } from 'zod';
import {
  insightLimits,
  lessonLimits,
  staleDefaults,
  staleBatchLimit,
  tagSorts,
  weightRange,
} from './insights.ts';

const tag = z.string().trim().min(1).max(40);
const isoDate = z.iso.datetime({ offset: true });

export const cardWeightInput = z
  .object({ weight: z.number().int().min(weightRange.min).max(weightRange.max) })
  .strict();
export const lessonInput = z
  .object({ text: z.string().trim().min(1).max(lessonLimits.length) })
  .strict();
export const tagMergeInput = z
  .object({ from: tag, to: tag })
  .strict()
  .refine((value) => value.from !== value.to, 'Choose a different new tag name.');
export const insightsQuery = z
  .object({
    tag: tag.optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    sort: z.enum(tagSorts).default('count'),
    tagLimit: z.number().int().min(1).max(insightLimits.tags).default(20),
    lessonLimit: z.number().int().min(1).max(insightLimits.lessons).default(5),
  })
  .strict()
  .refine(
    (value) => !value.from || !value.to || Date.parse(value.from) <= Date.parse(value.to),
    'The start date must be before the end date.',
  );
export const staleDays = z.coerce
  .number()
  .int()
  .min(staleDefaults.minimum)
  .max(staleDefaults.maximum)
  .default(staleDefaults.days);
export const staleApplyInput = z
  .object({
    days: staleDays,
    note: z.string().trim().max(500).default(''),
    cards: z
      .array(z.object({ id: z.uuid(), updatedAt: z.string().min(1).max(40) }).strict())
      .min(1)
      .max(staleBatchLimit),
  })
  .strict();
export interface StaleSubmission {
  id: string;
  company: string;
  title: string;
  updatedAt: string;
  /** Effective time of the last status change. */
  since: string;
  /** When the silence reached the selected number of days; used as the new effective time. */
  staleAt: string;
  idleDays: number;
  /** Non-empty when the card cannot change now, such as during active workflow work. */
  blocked: string;
}
