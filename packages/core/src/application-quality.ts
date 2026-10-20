import { z } from 'zod';

export const writingScope = z.enum(['all', 'resume', 'coverLetter']);
export interface WritingPreference {
  id: string;
  text: string;
  scope: z.infer<typeof writingScope>;
  origin: 'explicit' | 'learned';
  enabled: boolean;
  correctionIds: string[];
  createdAt: string;
}
export interface WritingProposal {
  id: string;
  text: string;
  scope: z.infer<typeof writingScope>;
  reason: string;
  roleId: string;
  runId: string;
  revision: number;
  status: 'pending' | 'applied' | 'rejected';
}
export interface WritingGuide {
  id: 'writing-guide';
  revision: number;
  automatic: boolean;
  learningSince: string;
  preferences: WritingPreference[];
  proposals: WritingProposal[];
}
export interface WritingCorrection {
  id: string;
  cardId: string;
  messageId: string;
  threadId: string;
  instruction: string;
  preference: string;
  scope: z.infer<typeof writingScope>;
  packetDigest: string;
  before: { resume: string; coverLetter: string };
  after?: { resume: string; coverLetter: string };
  retired: boolean;
  eligible: boolean;
  createdAt: string;
}
export const planScopeSchema = z
  .object({
    cardIds: z.array(z.uuid()).max(100).default([]),
    tag: z.string().trim().max(80).default(''),
    title: z.string().trim().max(120).default(''),
  })
  .strict()
  .refine(
    (s) => s.cardIds.length > 0 || !!s.tag || !!s.title,
    'Choose jobs, a tag or target role.',
  );
export const gapSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    kind: z.enum(['evidence', 'skill', 'coverage']),
    sources: z
      .array(
        z.object({ cardId: z.uuid(), requirement: z.string().trim().min(1).max(1500) }).strict(),
      )
      .min(1)
      .max(50),
    nextStep: z.string().trim().min(1).max(1000),
    completionCriterion: z.string().trim().min(1).max(1000),
    rationale: z.string().trim().min(1).max(1000),
  })
  .strict();
export type GapInput = z.infer<typeof gapSchema>;
export interface CareerGap extends GapInput {
  id: string;
  active: boolean;
  progress: 'planned' | 'in_progress' | 'completed';
  progressSource?: { messageId: string; quote: string };
  supportedInLatestAnalysis?: boolean;
}
export interface CareerPlan {
  id: string;
  revision: number;
  name: string;
  scope: z.infer<typeof planScopeSchema>;
  gaps: CareerGap[];
  sourceRevision: string;
  updatedAt: string;
  coverage: string;
}
export interface QualitySnapshot {
  writingGuide: WritingGuide;
  writingCorrections: Omit<WritingCorrection, 'before' | 'after'>[];
  careerPlans: (CareerPlan & { stale: boolean })[];
}
export const qualityUserInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('learning'), revision: z.number().int(), automatic: z.boolean() }),
  z.object({
    action: z.literal('preference'),
    revision: z.number().int(),
    text: z.string().trim().min(1).max(1000),
    scope: writingScope,
    id: z.uuid().optional(),
  }),
  z.object({
    action: z.literal('preference_state'),
    revision: z.number().int(),
    id: z.uuid(),
    operation: z.enum(['undo', 'disable', 'enable']),
  }),
  z.object({
    action: z.literal('proposal_decision'),
    revision: z.number().int(),
    id: z.uuid(),
    approved: z.boolean(),
  }),
  z.object({
    action: z.literal('plan_create'),
    name: z.string().trim().min(1).max(100),
    scope: planScopeSchema,
  }),
  z.object({
    action: z.literal('plan_priorities'),
    id: z.uuid(),
    revision: z.number().int(),
    gapIds: z.array(z.string().max(100)).max(3),
  }),
  z.object({
    action: z.literal('plan_progress'),
    id: z.uuid(),
    revision: z.number().int(),
    gapId: z.string().max(100),
    progress: z.enum(['planned', 'in_progress', 'completed']),
  }),
  z.object({
    action: z.literal('plan_gap_kind'),
    id: z.uuid(),
    revision: z.number().int(),
    gapId: z.string().max(100),
    kind: z.enum(['evidence', 'skill']),
  }),
  z.object({ action: z.literal('plan_delete'), id: z.uuid(), revision: z.number().int() }),
]);
export const qualityAgentInput = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('writing_read'),
    offset: z.number().int().min(0).max(100000).default(0),
  }),
  z.object({
    action: z.literal('writing_propose'),
    revision: z.number().int(),
    text: z.string().trim().min(1).max(1000),
    scope: writingScope,
    reason: z.string().trim().min(1).max(1500),
  }),
  z.object({
    action: z.literal('writing_correct'),
    messageId: z.uuid(),
    quote: z.string().trim().min(1).max(1000),
    preference: z.string().trim().min(1).max(1000),
    scope: writingScope,
    writerId: z.string().max(48),
  }),
  z.object({
    action: z.literal('writing_explicit'),
    messageId: z.uuid(),
    text: z.string().trim().min(1).max(1000),
    scope: writingScope,
  }),
  z.object({
    action: z.literal('plans_read'),
    id: z.uuid().optional(),
    offset: z.number().int().min(0).max(100000).default(0),
  }),
  z.object({
    action: z.literal('plan_refresh'),
    id: z.uuid(),
    revision: z.number().int(),
    sourceRevision: z.string().length(64),
    gaps: z.array(gapSchema).max(50),
    coverage: z.string().trim().min(1).max(2000),
  }),
  z.object({
    action: z.literal('plan_progress'),
    id: z.uuid(),
    revision: z.number().int(),
    gapId: z.string().max(100),
    progress: z.enum(['planned', 'in_progress', 'completed']),
    messageId: z.uuid(),
    quote: z.string().trim().min(1).max(1000),
  }),
]);
