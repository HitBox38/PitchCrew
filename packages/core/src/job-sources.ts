import { z } from 'zod';

/** Public, unauthenticated ATS job boards Pitchcrew can read. */
export const jobProviders = ['greenhouse', 'ashby', 'lever'] as const;
export type JobProvider = (typeof jobProviders)[number];
export const jobProviderLabels: Record<JobProvider, string> = {
  greenhouse: 'Greenhouse',
  ashby: 'Ashby',
  lever: 'Lever',
};
/** Letters, digits, hyphens and underscores only: no dots, slashes, encodings or queries. */
export const jobBoardSlugPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
export const maxJobSources = 25;
export const maxNewLeadsPerScan = 50;

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
export const jobSourceInput = z
  .object({
    provider: z.enum(jobProviders),
    slug: z
      .string()
      .trim()
      .regex(
        jobBoardSlugPattern,
        'Use the board name from the job board link: letters, numbers, hyphens or underscores.',
      ),
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
/** Provenance saved on cards created from a job source (event version 10). */
export interface JobDiscovery {
  provider: JobProvider;
  sourceId: string;
  sourceName: string;
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
