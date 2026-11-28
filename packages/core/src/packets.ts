import { packetTextLimits } from './packet-documents.ts';
import { z } from 'zod';

export const packetSchema = z.object({
  resume: z.string().min(1).max(packetTextLimits.resume),
  coverLetter: z.string().min(1).max(packetTextLimits.coverLetter),
  formAnswers: z.string().max(packetTextLimits.formAnswers),
  // Internal handoff for the user and Reviewer, never employer-facing; an omitted note is empty.
  note: z.string().max(packetTextLimits.note).default(''),
  claims: z
    .array(
      z.object({
        claim: z.string().min(1).max(2000),
        source: z.string().min(1).max(200),
        quote: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(80),
});
export type Packet = z.infer<typeof packetSchema>;

/** Lint input for targeted resume readers only; never a draft, full review or export packet. */
export const resumeReviewPacketSchema = packetSchema.extend({
  coverLetter: z.literal(''),
  formAnswers: z.literal(''),
  note: z.literal('').default(''),
  // A full packet can have claims only in documents hidden from this reader.
  claims: z.array(packetSchema.shape.claims.element).max(80),
});

const handoffLine = z.string().trim().min(1).max(600);
/** Reviewer's account of a passed packet for the user deciding on approval. Event v32. */
export const packetReviewSummarySchema = z.object({
  assessment: z.string().trim().min(1).max(1500),
  highlights: z.array(handoffLine).max(6).default([]),
  limitations: z.array(handoffLine).max(6).default([]),
  nextSteps: z.array(handoffLine).min(1).max(5),
});
export type PacketReviewSummary = z.infer<typeof packetReviewSummarySchema>;
/** Writer's notes on what a revision changed from the previous draft. Event v32. */
export const packetChangeNotesSchema = z.array(handoffLine).min(1).max(8);
/** Change notes bound to the exact packet they describe. */
export interface PacketChanges {
  packetDigest: string;
  notes: string[];
}

// Formatted exports lay out headings, lists and links; plain exports print the Markdown literally.
export type ArtifactLayout = 'formatted' | 'plain';
export interface DocumentFinding {
  severity: 'error' | 'warn';
  check: 'readability' | 'content' | 'layout' | 'render';
  message: string;
  page?: number;
}
export interface DocumentVerification {
  name: PacketArtifact['name'];
  digest?: string;
  status: 'verified' | 'blocked';
  findings: DocumentFinding[];
}
export interface PacketArtifact {
  name: 'resume.pdf' | 'resume.docx' | 'cover_letter.pdf' | 'cover_letter.docx';
  mimeType: string;
  digest: string;
  bytes: string;
  source: 'resume' | 'coverLetter';
  layout?: ArtifactLayout;
  verification?: DocumentVerification;
}
