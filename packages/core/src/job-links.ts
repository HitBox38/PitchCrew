import { z } from 'zod';
import type { CardState } from './states.ts';
import {
  jobBoardSlugPattern,
  jobProviderLabels,
  jobProviders,
  type JobProvider,
} from './job-sources.ts';

/**
 * Posting links the user can paste in Add job. Recognition is pure: it reads the provider, board
 * name and job ID from a link and never fetches it. The daemon then calls only the provider's
 * fixed public endpoint, rebuilt from the validated board name and job ID.
 */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Job ID shapes per provider. A provider without an entry has no link support yet. */
export const jobLinkIdPatterns: Partial<Record<JobProvider, RegExp>> = {
  greenhouse: /^[0-9]{1,20}$/,
  ashby: uuid,
  lever: uuid,
};
/** Whether `id` is a job ID of `provider`. Unknown or unsupported providers never match. */
export function isJobLinkId(provider: string, id: string): boolean {
  const pattern = Object.hasOwn(jobLinkIdPatterns, provider)
    ? jobLinkIdPatterns[provider as JobProvider]
    : undefined;
  return !!pattern && pattern.test(id);
}
/** Discovery `sourceId` on cards added from a pasted link rather than a saved source. */
export const jobLinkSourceId = 'link';
export const maxJobLinkLength = 2000;

export interface JobLink {
  provider: JobProvider;
  board: string;
  jobId: string;
  /** The provider-hosted posting page for this board and job ID. */
  url: string;
}
export type JobLinkRecognition =
  | { recognized: true; link: JobLink }
  | { recognized: false; reason: string };

const hostedUrl: Partial<Record<JobProvider, (board: string, id: string) => string>> = {
  greenhouse: (board, id) => `https://job-boards.greenhouse.io/${board}/jobs/${id}`,
  ashby: (board, id) => `https://jobs.ashbyhq.com/${board}/${id}`,
  lever: (board, id) => `https://jobs.lever.co/${board}/${id}`,
};
const greenhouseHosts = new Set(['boards.greenhouse.io', 'job-boards.greenhouse.io']);
/** Known hosts Pitchcrew cannot read yet, with the reason shown to the user. */
const unsupportedHosts = new Map([
  ['job-boards.eu.greenhouse.io', 'Greenhouse EU boards are not supported yet.'],
  ['boards.eu.greenhouse.io', 'Greenhouse EU boards are not supported yet.'],
  ['jobs.eu.lever.co', 'Lever EU boards are not supported yet.'],
]);
const notRecognized = 'This link is not a Greenhouse, Ashby or Lever job posting.';
const fail = (reason: string): JobLinkRecognition => ({ recognized: false, reason });

function found(provider: JobProvider, board: string, rawId: string): JobLinkRecognition {
  const jobId = provider === 'greenhouse' ? rawId : rawId.toLowerCase();
  if (!jobBoardSlugPattern.test(board) || board.toLowerCase() === 'embed')
    return fail(`The ${jobProviderLabels[provider]} board name in this link is not valid.`);
  if (!isJobLinkId(provider, jobId))
    return fail(`The ${jobProviderLabels[provider]} job ID in this link is not valid.`);
  const url = hostedUrl[provider]!(board, jobId);
  return { recognized: true, link: { provider, board, jobId, url } };
}

function greenhouse(segments: string[], query: URLSearchParams): JobLinkRecognition {
  const ghJid = query.get('gh_jid');
  // boards.greenhouse.io/{board}/jobs/{id}, optionally repeating the ID as gh_jid.
  if (segments.length === 3 && segments[1] === 'jobs') {
    if (ghJid !== null && ghJid !== segments[2])
      return fail('This link names two different Greenhouse jobs.');
    return found('greenhouse', segments[0]!, segments[2]!);
  }
  // boards.greenhouse.io/embed/job_app?for={board}&token={id}
  if (segments.length === 2 && segments[0] === 'embed' && segments[1] === 'job_app') {
    const board = query.get('for');
    const id = query.get('token') ?? ghJid;
    return board && id ? found('greenhouse', board, id) : fail(notRecognized);
  }
  // boards.greenhouse.io/{board}?gh_jid={id}
  if (segments.length === 1 && ghJid !== null) return found('greenhouse', segments[0]!, ghJid);
  return fail('This Greenhouse link does not point to a single job posting.');
}

function companyPage(query: URLSearchParams): JobLinkRecognition {
  const ghJid = query.get('gh_jid');
  const board = query.get('for');
  // An embedded Greenhouse job is readable only when the link also names its board.
  if (ghJid !== null && board !== null) return found('greenhouse', board, ghJid);
  if (ghJid !== null)
    return fail(
      'This company page embeds a Greenhouse job, but the link does not name the board. Open the job on job-boards.greenhouse.io and paste that link.',
    );
  if (query.has('ashby_jid'))
    return fail(
      'This company page embeds an Ashby job, but the link does not name the board. Open the job on jobs.ashbyhq.com and paste that link.',
    );
  return fail(notRecognized);
}

/**
 * Read the provider, board name and job ID from a pasted posting link. Unknown links are a normal
 * result, not an error. Only https links without user info or a port are accepted, and the raw
 * path must match the parsed path exactly, so dot segments and encoded separators never reach
 * the board name or job ID.
 */
export function recognizeJobLink(value: string): JobLinkRecognition {
  const raw = value.trim();
  if (!raw) return fail('Paste a job posting link.');
  if (raw.length > maxJobLinkLength) return fail('This link is too long.');
  if (!/^[\x21-\x7e]+$/.test(raw)) return fail(notRecognized);
  const authority = /^https:\/\/[^/?#]*/i.exec(raw);
  if (!authority) return fail('Use an https link to the job posting.');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail(notRecognized);
  }
  if (url.username || url.password || url.port) return fail(notRecognized);
  const rawPath = raw.slice(authority[0].length).split(/[?#]/)[0] || '/';
  if (rawPath !== url.pathname || rawPath.includes('%')) return fail(notRecognized);
  const path = rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
  const segments = path ? path.slice(1).split('/') : [];
  if (segments.some((segment) => !segment)) return fail(notRecognized);
  const host = url.hostname;
  const unsupported = unsupportedHosts.get(host);
  if (unsupported) return fail(unsupported);
  if (greenhouseHosts.has(host)) return greenhouse(segments, url.searchParams);
  if (host === 'jobs.ashbyhq.com') {
    // jobs.ashbyhq.com/{board}/{id}, optionally followed by /application.
    if (segments.length === 2 || (segments.length === 3 && segments[2] === 'application'))
      return found('ashby', segments[0]!, segments[1]!);
    return fail('This Ashby link does not point to a single job posting.');
  }
  if (host === 'jobs.lever.co') {
    // jobs.lever.co/{site}/{id}, optionally followed by /apply.
    if (segments.length === 2 || (segments.length === 3 && segments[2] === 'apply'))
      return found('lever', segments[0]!, segments[1]!);
    return fail('This Lever link does not point to a single job posting.');
  }
  return companyPage(url.searchParams);
}

export const jobLookupInput = z.object({ url: z.string().max(maxJobLinkLength) }).strict();
/**
 * Provenance the UI sends back when the user saves a fetched job. It is saved as the card's
 * `discovery` (event version 10 shape) with `sourceId` set to `jobLinkSourceId`.
 */
export const jobLinkProvenance = z
  .object({
    provider: z.enum(jobProviders),
    board: z.string().regex(jobBoardSlugPattern),
    jobId: z.string().max(200),
    postedAt: z.iso.datetime({ offset: true }).nullable().default(null),
  })
  .strict()
  .refine(
    (value) => isJobLinkId(value.provider, value.jobId),
    'The job ID does not match the provider.',
  );
export type JobLinkProvenance = z.infer<typeof jobLinkProvenance>;
/** Form values read from one posting. Nothing is saved until the user adds the job. */
export interface JobLookupPrefill {
  company: string;
  title: string;
  location: string;
  url: string;
  salary: string;
  description: string;
  jobIdentifier: string;
  provenance: JobLinkProvenance;
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
