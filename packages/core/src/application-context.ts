import { z } from 'zod';
import type { Card } from './cards.ts';

const lines = z.array(z.string().trim().min(1).max(1500)).max(30);
export const jobBriefSchema = z
  .object({
    companyContext: z.string().trim().max(3000),
    responsibilities: lines,
    qualifications: lines,
    constraints: lines,
  })
  .strict();
export const applicationRequirementSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,80}$/),
    question: z.string().trim().min(1).max(2000),
    required: z.boolean(),
    personal: z.boolean(),
    answer: z.string().trim().max(8000).default(''),
  })
  .strict();
export const extractedJobSchema = z
  .object({
    brief: jobBriefSchema,
    requirements: z.array(applicationRequirementSchema).max(40),
    flagged: z
      .array(
        z
          .object({
            text: z.string().max(2000),
            reason: z.string().max(1000),
          })
          .strict(),
      )
      .max(60),
  })
  .strict()
  .refine(
    (value) => new Set(value.requirements.map((r) => r.id)).size === value.requirements.length,
    'Requirement IDs must be unique.',
  );
export type ExtractedJob = z.infer<typeof extractedJobSchema>;
export interface ApplicationContext extends ExtractedJob {
  sourceRevision: string;
  revision: string;
  visibility: 'unknown';
  createdAt: string;
  confirmedAt?: string;
  confirmedRevision?: string;
  provenance: 'extraction' | 'user';
}
export interface PacketReviewEvidence {
  contextRevision: string;
  packetDigest: string;
  runId: string;
  reviewedAt: string;
}
export function missingPersonalAnswers(context: ApplicationContext) {
  return context.requirements.filter((r) => r.required && r.personal && !r.answer.trim());
}
/** User-approved reference data only. Never return flagged excerpts or source descriptions. */
export function draftingCard(card: Card, purpose = 'application-review'): Card {
  const context = card.applicationContext;
  return {
    id: card.id,
    company: card.company,
    title: card.title,
    location: card.location,
    salary: card.salary,
    url: card.url,
    tags: [...card.tags],
    description: '',
    state: card.state,
    fit: null,
    owner: card.owner,
    packet:
      purpose === 'application-review' ||
      (purpose === 'application-draft' && card.packetContextRevision === context?.revision)
        ? card.packet
        : null,
    feedback: [],
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    sample: card.sample,
    packetContextRevision: card.packetContextRevision,
    ...(context
      ? {
          applicationContext: {
            brief: context.brief,
            requirements: context.requirements,
            flagged: [],
            sourceRevision: context.sourceRevision,
            revision: context.revision,
            visibility: context.visibility,
            createdAt: context.createdAt,
            confirmedAt: context.confirmedAt,
            confirmedRevision: context.confirmedRevision,
            provenance: context.provenance,
          },
        }
      : {}),
  };
}
