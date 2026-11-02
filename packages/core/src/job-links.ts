import { z } from 'zod';
import { cardInput } from './cards.ts';
import type { CardState } from './states.ts';
import { jobProviders } from './job-source-identifiers.ts';
import { isJobLinkBoard, isJobLinkId, maxJobLinkLength } from './job-link-recognition.ts';
export * from './job-link-recognition.ts';

export const jobLookupInput = z.object({ url: z.string().max(maxJobLinkLength) }).strict();
/** Only agent-extracted descriptions: never rewrite saved records or user-authored text. */
export const extractedJobDescription = z
  .string()
  .trim()
  .max(20000)
  .refine(
    (text) => !hasBrowserExtractionSyntax(text),
    'Description contains browser accessibility/extraction syntax. Copy the full original posting wording into readable headings, paragraphs and bullets; remove only extraction labels such as heading, [level=2], paragraph:, list: and listitem:. Do not summarize, rewrite, translate or truncate. Inspect again if the complete posting is unavailable. Nothing was saved.',
  );

const hasBrowserExtractionSyntax = (text: string): boolean => {
  let nodes = 0;
  for (const line of text.split(/\r?\n/)) {
    // Require snapshot-shaped lines, not ordinary prose mentioning accessibility roles.
    if (/^\s*(?:-\s+)?heading\s+".*"\s+\[level=\d+\](?:\s+\[[^\]]*\])*(?:\s*:)?\s*$/.test(line))
      return true;
    if (/^\s*(?:-\s+)?(?:paragraph|list|listitem):(?:\s|$)/.test(line)) nodes++;
    if (nodes >= 2) return true;
  }
  return false;
};

/** Agent-extracted details from public HTML or an inspected browser posting. */
export const jobLinkDetails = cardInput
  .pick({ company: true, title: true, location: true, salary: true, description: true })
  .extend({
    location: z.string().trim().max(120).default(''),
    description: extractedJobDescription.min(1),
  })
  .strict();
export const jobLinkImportInput = jobLookupInput
  .extend({
    cardId: z.uuid().optional(),
    // Browser evidence is converted at the scoped import boundary before final validation.
    details: jobLinkDetails.extend({ description: z.string().trim().min(1).max(20000) }).optional(),
    /** Read the current scoped browser instead of fetching HTML; requires computerUse. */
    browserDigest: z.string().trim().min(1).max(128).optional(),
  })
  .superRefine((input, context) => {
    if (input.browserDigest || !input.details) return;
    const parsed = jobLinkDetails.safeParse(input.details);
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        context.addIssue({ ...issue, path: ['details', ...issue.path] });
  });
/**
 * Provenance the UI sends back when the user saves a fetched job. It is saved as the card's
 * `discovery` (event version 10 shape) with `sourceId` set to `jobLinkSourceId`. It never holds
 * a Comeet token.
 */
export const jobLinkProvenance = z
  .object({
    provider: z.enum(jobProviders),
    board: z.string().max(80),
    jobId: z.string().max(200),
    postedAt: z.iso.datetime({ offset: true }).nullable().default(null),
  })
  .strict()
  .refine(
    (value) => isJobLinkBoard(value.provider, value.board),
    'The board name does not match the provider.',
  )
  .refine(
    (value) => isJobLinkId(value.provider, value.jobId),
    'The job ID does not match the provider.',
  );
export type JobLinkProvenance = z.infer<typeof jobLinkProvenance>;
/** Form values read from one posting. Nothing is saved until the user adds the job. */
export interface JobLookupPrefill {
  sourceHtml?: string;
  company: string;
  title: string;
  location: string;
  url: string;
  salary: string;
  description: string;
  jobIdentifier: string;
  provenance?: JobLinkProvenance;
}
export interface JobLookupDuplicate {
  id: string;
  company: string;
  title: string;
  state: CardState;
}
export type JobLookupResult =
  | { status: 'found'; prefill: JobLookupPrefill; duplicates: JobLookupDuplicate[] }
  | { status: 'unrecognized' | 'failed'; reason: string };

/** Agent imports create leads or refresh an explicit card; duplicates expose IDs and statuses. */
export type JobLinkImportResult =
  | {
      status: 'updated';
      card: {
        id: string;
        company: string;
        title: string;
        url: string;
        state: CardState;
        excerpt: string;
      };
    }
  | { status: 'needs_details'; url: string; text: string; reason: string }
  | {
      status: 'added';
      lead: {
        id: string;
        company: string;
        title: string;
        location: string;
        url: string;
        excerpt: string;
      };
    }
  | { status: 'duplicate'; duplicates: Pick<JobLookupDuplicate, 'id' | 'state'>[] }
  | { status: 'unrecognized' | 'failed'; reason: string };
