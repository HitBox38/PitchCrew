import { z } from 'zod';
import type { RoleId } from './states.ts';

const date = z.iso.datetime({ offset: true }).transform((value) => new Date(value).toISOString());
export const pipelineScope = z
  .object({
    cardIds: z.array(z.uuid()).max(50).default([]),
    from: date.optional(),
    to: date.optional(),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    'The review dates are reversed.',
  );
export const pipelineQuery = z.object({
  section: z.enum([
    'cards',
    'runs',
    'events',
    'roles',
    'reviews',
    'run_configuration',
    'role_configuration',
    'packet',
    'review',
  ]),
  entityId: z.string().min(1).max(100).optional(),
  scope: pipelineScope.default({ cardIds: [] }),
  cursor: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(50).default(20),
});
export const pipelineFinding = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
  targetRoleId: z.string().min(1).max(64),
  criterion: z.string().trim().min(1).max(500),
  kind: z.enum(['observation', 'hypothesis']),
  finding: z.string().trim().min(1).max(2000),
  evidenceEventIds: z.array(z.number().int().positive()).min(1).max(10),
  nextRunImprovement: z.string().trim().min(1).max(2000),
  measurement: z.string().trim().min(1).max(1000),
});
export const pipelineReviewInput = z
  .object({
    title: z.string().trim().min(1).max(160),
    scope: pipelineScope,
    criteria: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
    seats: z
      .array(
        z.object({
          roleId: z.string().min(1).max(64),
          assessment: z.enum(['assessed', 'insufficient_evidence']),
          rationale: z.string().trim().min(1).max(1000),
        }),
      )
      .min(1)
      .max(50),
    findings: z.array(pipelineFinding).min(1).max(12),
  })
  .refine(
    (value) => new Set(value.findings.map((f) => f.id)).size === value.findings.length,
    'Finding IDs must be unique.',
  );
export const pipelineFollowupInput = z
  .object({
    reviewId: z.uuid(),
    findingId: z.string().min(1).max(40),
    status: z.enum(['open', 'evaluating', 'resolved', 'dismissed']),
    result: z.string().trim().max(2000),
    metrics: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(100),
          value: z.number().finite(),
          unit: z.string().trim().max(40),
        }),
      )
      .max(10),
    evidenceEventIds: z.array(z.number().int().positive()).max(10),
  })
  .refine(
    (value) =>
      value.status !== 'resolved' || (value.result.length > 0 && value.evidenceEventIds.length > 0),
    'Resolved findings require a result and follow-up evidence.',
  );
export interface PipelineEvidence {
  eventId: number;
  kind: string;
  entityId: string;
  actor: string;
  createdAt: string;
  message: string;
  summary: string;
}
export interface PipelineReview {
  id: string;
  roleId: RoleId;
  runId: string;
  threadId: RoleId | 'crew';
  title: string;
  scope: z.infer<typeof pipelineScope>;
  criteria: string[];
  seats: z.infer<typeof pipelineReviewInput>['seats'];
  findings: z.infer<typeof pipelineFinding>[];
  followups: Omit<z.infer<typeof pipelineFollowupInput>, 'reviewId'>[];
  evidence: PipelineEvidence[];
  noticeMessageId: string;
  createdAt: string;
  updatedAt: string;
}
