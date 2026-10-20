import { z } from 'zod';

import {
  jobProviders,
  jobProviderNeedsToken,
  jobSourceSlugPatterns,
  comeetTokenPattern,
  maxJobSources,
  type JobProvider,
} from './job-source-identifiers.ts';
/** Check the saved identifiers against the strict pattern for the chosen provider. */
export const refineJobSource = (
  value: { provider: JobProvider; slug: string; token?: string | undefined },
  context: z.RefinementCtx,
) => {
  const issue = (path: string, message: string) =>
    context.addIssue({ code: 'custom', path: [path], message });
  if (!jobSourceSlugPatterns[value.provider].test(value.slug))
    issue(
      'slug',
      value.provider === 'comeet'
        ? 'Use the company UID from the Comeet careers link, such as A1.B2C.'
        : value.provider === 'ashby'
          ? 'Use the board name from the Ashby link: letters, numbers, hyphens, underscores, and single dots or spaces between them.'
          : 'Use the board name from the job board link: letters, numbers, hyphens or underscores.',
    );
  if (!jobProviderNeedsToken(value.provider)) {
    if (value.token !== undefined) issue('token', 'Only Comeet sources use a token.');
  } else if (!value.token || !comeetTokenPattern.test(value.token))
    issue('token', 'Paste the Comeet careers token: letters, numbers, hyphens or underscores.');
};

export * from './job-source-identifiers.ts';

const keywords = z
  .array(z.string().trim().min(1).max(60))
  .max(20)
  .default([])
  .transform((values) => [...new Set(values)]);
export const jobSourceFilters = z
  .object({
    titleInclude: keywords,
    titleExclude: keywords,
    locationInclude: keywords,
    remoteOnly: z.boolean().default(false),
  })
  .strict();
/** Source fields before provider-specific identifier checks; extend this, then refine. */
export const jobSourceFields = z
  .object({
    provider: z.enum(jobProviders),
    slug: z.string().trim(),
    token: z.string().trim().max(128).optional(),
    name: z.string().trim().min(1).max(80),
    enabled: z.boolean().default(true),
    filters: jobSourceFilters.default({
      titleInclude: [],
      titleExclude: [],
      locationInclude: [],
      remoteOnly: false,
    }),
  })
  .strict();
export const jobSourceInput = jobSourceFields.superRefine(refineJobSource);
export type JobSourceInput = z.infer<typeof jobSourceInput>;
export type JobSourceFilters = z.infer<typeof jobSourceFilters>;
export interface JobSourceScanStatus {
  at: string;
  status: 'ok' | 'failed';
  error?: string;
  fetched: number;
  new: number;
  duplicate: number;
  filtered: number;
}
export interface JobSource extends JobSourceInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  lastScan?: JobSourceScanStatus;
}
/** One normalized posting from a provider response. */
export interface JobPosting {
  sourceHtml?: string;
  provider: JobProvider;
  jobId: string;
  title: string;
  location: string;
  remote: boolean;
  url: string;
  description: string;
  salary: string;
  postedAt: string | null;
}
/**
 * Provenance saved on cards created from a job source (event version 10). Comeet and Workable
 * widen `provider` without a new event version: older events keep their values, and decoding
 * never rejected an unknown provider.
 */
export interface JobDiscovery {
  provider: JobProvider;
  sourceId: string;
  sourceName: string;
  /** Board or account name; the company UID for Comeet. */
  slug: string;
  jobId: string;
  firstSeenAt: string;
  postedAt: string | null;
}
export interface JobSourcePreview {
  fetched: number;
  matching: number;
  filtered: number;
  duplicate: number;
  truncated: boolean;
  postings: (Pick<JobPosting, 'jobId' | 'title' | 'location' | 'remote' | 'url'> & {
    onBoard: boolean;
  })[];
}
export interface JobSourceScanResult {
  sourceId: string;
  name: string;
  provider: JobProvider;
  status: 'ok' | 'failed' | 'skipped';
  error?: string;
  fetched: number;
  new: number;
  duplicate: number;
  filtered: number;
  deferred: number;
}
export interface JobScanSummary {
  scannedAt: string;
  new: number;
  duplicate: number;
  filtered: number;
  deferred: number;
  failedSources: number;
  sources: JobSourceScanResult[];
  newLeads: {
    id: string;
    company: string;
    title: string;
    location: string;
    url: string;
    sourceId: string;
    excerpt: string;
  }[];
}
export const jobScanInput = z
  .object({ sourceIds: z.array(z.uuid()).min(1).max(maxJobSources).optional() })
  .strict();
