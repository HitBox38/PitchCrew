import { roleIdSchema } from './roles.ts';
import { z } from 'zod';
import { type RoleId } from './states.ts';

export const routineInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    roleId: roleIdSchema,
    content: z.string().trim().min(1).max(8000),
    cardId: z.uuid().nullable().default(null),
    conversationId: z.string().min(1).max(100).nullable().optional(),
    startAt: z.iso.datetime({ offset: true }),
    timezone: z.string().trim().min(1).max(100),
    cron: z.string().trim().min(1).max(120).nullable().default(null),
    intervalMinutes: z.number().int().min(1).max(5256000).nullable().default(null),
    maxRuns: z.number().int().min(1).max(1000000).nullable().default(null),
    endsAt: z.iso.datetime({ offset: true }).nullable().default(null),
    enabled: z.boolean().default(true),
  })
  .strict()
  .refine(
    (input) => !(input.cron && input.intervalMinutes),
    'Choose cron or an interval, not both.',
  )
  .refine(
    (input) => !input.endsAt || Date.parse(input.endsAt) >= Date.parse(input.startAt),
    'End must be on or after the start.',
  );

export type RoutineInput = z.infer<typeof routineInput>;
export interface Routine extends RoutineInput {
  id: string;
  createdBy: 'user' | RoleId;
  updatedBy: 'user' | RoleId;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  runCount: number;
  nextRunAt: string | null;
  lastRunId: string | null;
  lastScheduledAt: string | null;
  error: string;
}
