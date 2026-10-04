import type { FormAssessment, SubmissionAttempt } from './submissions.ts';
import { z } from 'zod';
import type { Packet } from './packets.ts';
import type { ApplicationTracking } from './tracking.ts';
import type { JobDiscovery } from './job-sources.ts';
import { type CardState, type RoleId } from './states.ts';

export const cardInput = z.object({
  company: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(160),
  location: z.string().trim().max(120).default('Remote'),
  url: z
    .union([
      z.literal(''),
      z
        .url()
        .refine(
          (v) => ['https:', 'http:'].includes(new URL(v).protocol),
          'Use an HTTP or HTTPS URL',
        ),
    ])
    .default(''),
  salary: z.string().trim().max(100).default(''),
  description: z.string().trim().max(20000).default(''),
  tags: z.array(z.string().max(40)).max(10).default([]),
});
export type CardInput = z.infer<typeof cardInput>;
/** A short user-written learning note; agents can read lessons but never write them. */
export interface CardLesson {
  id: string;
  text: string;
  createdAt: string;
}
export interface Card extends CardInput {
  tracking?: ApplicationTracking;
  /** User-only signal from -2 (strong miss) to +2 (strong win); absent means 0. Event v11. */
  weight?: number;
  /** User-only lessons, newest last. Event v11. */
  lessons?: CardLesson[];
  discovery?: JobDiscovery;
  statusEffectiveAt?: string;
  id: string;
  state: CardState;
  fit: number | null;
  owner: RoleId | null;
  packet: Packet | null;
  feedback: string[];
  createdAt: string;
  updatedAt: string;
  sample: boolean;
  formAssessments?: FormAssessment[];
  submissionAttempts?: SubmissionAttempt[];
}
