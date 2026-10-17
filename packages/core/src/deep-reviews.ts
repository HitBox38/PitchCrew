import { z } from 'zod';
import { reasoningLevels } from './reasoning.ts';
import { roleIdSchema } from './roles.ts';
import { runtimeIds } from './states.ts';
import { reviewPerspectives, type ReviewPerspective } from './deep-review-labels.ts';

export const reviewPerspectiveSchema = z.enum(
  Object.keys(reviewPerspectives) as [ReviewPerspective, ...ReviewPerspective[]],
);
export const reviewFindingSchema = z.object({
  severity: z.enum(['blocking', 'advisory']),
  quote: z.string().trim().min(1).max(2000),
  reason: z.string().trim().min(1).max(2000),
  correction: z.string().trim().min(1).max(2000),
  perspectives: z.array(reviewPerspectiveSchema).min(1).max(11),
});
export const reviewAssessmentSchema = z.object({
  summary: z.string().trim().min(1).max(4000),
  packetFeedback: z.array(z.string().max(2000)).max(30).optional(),
  suggestions: z.array(z.string().max(2000)).max(60).optional(),
  perspectives: z
    .array(
      z.object({
        perspective: reviewPerspectiveSchema,
        verdict: z.enum(['PASS', 'REJECT', 'INTERVIEW', 'NO', 'HIRE', 'MAYBE']),
        rationale: z.string().trim().min(1).max(2000),
        weakestLine: z.string().max(2000).default(''),
        interviewQuestions: z.array(z.string().max(1000)).max(5).default([]),
      }),
    )
    .min(1)
    .max(11)
    .refine(
      (items) => new Set(items.map((i) => i.perspective)).size === items.length,
      'Review each perspective once.',
    ),
  findings: z.array(reviewFindingSchema).max(60),
});
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
export type ReviewAssessment = z.infer<typeof reviewAssessmentSchema>;
export const reviewRuntimeAlternativeSchema = z
  .object({
    runtime: z.enum(runtimeIds),
    model: z.string().trim().max(100),
    reasoning: z.enum(reasoningLevels).nullable().optional(),
  })
  .strict();
export type ReviewRuntimeAlternative = z.infer<typeof reviewRuntimeAlternativeSchema>;
export const deepReviewOptionsSchema = z
  .object({
    reviewerId: roleIdSchema.optional(),
    writerId: roleIdSchema.optional(),
    alternatives: z.array(reviewRuntimeAlternativeSchema).max(12).default([]),
    secondOpinions: z.boolean().default(false),
    requestedPerspectives: z
      .array(reviewPerspectiveSchema)
      .max(11)
      .default([])
      .refine(
        (items) => new Set(items).size === items.length,
        'Choose each requested perspective once.',
      ),
    threadId: z.string().min(1).max(100).optional(),
  })
  .strict();
export type DeepReviewOptions = z.infer<typeof deepReviewOptionsSchema>;
export interface DeepReview {
  id: string;
  version: 1;
  cardId: string;
  runId: string;
  reviewerId: string;
  writerId: string;
  threadId: string;
  sourceThreadId?: string;
  sourceRunId?: string;
  status: 'running' | 'waiting' | 'completed' | 'needs_changes' | 'failed' | 'cancelled';
  stage: 'draft' | 'review' | 'correction' | 'recheck';
  contextRevision: string;
  profileDigest: string;
  originalResume?: string;
  finalResume?: string;
  inputPacketDigest?: string;
  currentPacketDigest?: string | null;
  beforeProfileDigest?: string;
  beforeContextRevision?: string;
  finalPacketDigest?: string;
  before?: ReviewAssessment;
  after?: ReviewAssessment;
  summary: string;
  error?: string;
  options: DeepReviewOptions;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  deadlineAt: string;
  remainingMs?: number;
  extensions: { at: string; minutes: number; reason: string }[];
}
export type DeepReviewSummary = Pick<
  DeepReview,
  | 'id'
  | 'cardId'
  | 'runId'
  | 'status'
  | 'stage'
  | 'summary'
  | 'createdAt'
  | 'updatedAt'
  | 'deadlineAt'
>;
export interface ReviewSubagent {
  stage: DeepReview['stage'];
  inputPacketDigest: string | null;
  id: string;
  reviewId: string;
  runId: string;
  perspective: ReviewPerspective;
  focus: string;
  reason: string;
  runtime: (typeof runtimeIds)[number];
  model: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'unavailable';
  assessment?: ReviewAssessment;
  error?: string;
  timeRequest?: { minutes: number; reason: string; requestedAt: string };
  createdAt: string;
  finishedAt: string | null;
}
export const reviewSubagentInput = z
  .object({
    perspective: reviewPerspectiveSchema,
    focus: z.string().trim().min(10).max(2000),
    reason: z.string().trim().min(10).max(2000),
    alternative: z.number().int().min(0).max(11).optional(),
  })
  .strict();
export const reviewTimeInput = z
  .object({
    minutes: z.number().int().min(1).max(30),
    reason: z.string().trim().min(10).max(2000),
  })
  .strict();
/** Mutable shared deadline, owned by the parent review and read by restricted CLI launches. */
export interface RuntimeDeadline {
  expiresAt: number;
}
export interface DeepReviewRunContext {
  id: string;
  budgetRequest?: { minutes: number; reason: string };
  stage: DeepReview['stage'];
  subagent?: { perspective: ReviewPerspective; focus: string };
  findings?: ReviewFinding[];
  clarifications?: { question: string; answer: string }[];
  secondOpinionResults?: {
    perspective: ReviewPerspective;
    status: ReviewSubagent['status'];
    summary?: string;
    findings: ReviewFinding[];
    error?: string;
  }[];
  secondOpinions: boolean;
  requestedPerspectives: ReviewPerspective[];
  maxConcurrentSubagents: number;
  alternatives: ReviewRuntimeAlternative[];
}
