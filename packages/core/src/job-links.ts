import { z } from 'zod';
import type { CardState } from './states.ts';
import {
  comeetCompanyUidPattern,
  comeetTokenPattern,
  jobProviderLabels,
  jobProviders,
  jobSourceSlugPatterns,
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
  // Comeet position UIDs share the company UID shape, such as `A1.00D`.
  comeet: comeetCompanyUidPattern,
  // Workable shortcodes are uppercase letters and digits, usually 10 characters.
  workable: /^[A-Z0-9]{8,12}$/,
};
const own = <T>(table: Partial<Record<JobProvider, T>>, provider: string): T | undefined =>
  Object.hasOwn(table, provider) ? table[provider as JobProvider] : undefined;
/** Whether `id` is a job ID of `provider`. Unknown or unsupported providers never match. */
export function isJobLinkId(provider: string, id: string): boolean {
  return !!own(jobLinkIdPatterns, provider)?.test(id);
}
/** Whether `board` is a saved-source identifier of `provider` (the company UID for Comeet). */
export function isJobLinkBoard(provider: string, board: string): boolean {
  return !!own(jobSourceSlugPatterns, provider)?.test(board);
}
/** Discovery `sourceId` on cards added from a pasted link rather than a saved source. */
export const jobLinkSourceId = 'link';
export const maxJobLinkLength = 2000;

export interface JobLink {
  provider: JobProvider;
  /** Board or account name; the company UID for Comeet. */
  board: string;
  jobId: string;
  /** The provider-hosted posting page for this board and job ID, without any token. */
  url: string;
  /**
   * A Comeet careers token read from an embed link. It is used for one lookup only and never
   * returned, saved or shown.
   */
  token?: string;
}
export type JobLinkRecognition =
  | { recognized: true; link: JobLink }
  | { recognized: false; reason: string };

const hostedUrl: Partial<Record<JobProvider, (board: string, id: string) => string>> = {
  greenhouse: (board, id) => `https://job-boards.greenhouse.io/${board}/jobs/${id}`,
  ashby: (board, id) => `https://jobs.ashbyhq.com/${encodeURIComponent(board)}/${id}`,
  lever: (board, id) => `https://jobs.lever.co/${board}/${id}`,
  comeet: (board, id) => `https://www.comeet.co/jobs/${board}/${id}`,
  workable: (board, id) => `https://apply.workable.com/${board}/j/${id}/`,
};
const greenhouseHosts = new Set(['boards.greenhouse.io', 'job-boards.greenhouse.io']);
const comeetHostedHosts = new Set(['www.comeet.com', 'comeet.com']);
const comeetEmbedHosts = new Set(['www.comeet.co', 'comeet.co']);
/** A readable name or title segment in a Comeet hosted link. Pitchcrew ignores its value. */
const comeetSlugSegment = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
/** Known hosts Pitchcrew cannot read yet, with the reason shown to the user. */
const unsupportedHosts = new Map([
  ['job-boards.eu.greenhouse.io', 'Greenhouse EU boards are not supported yet.'],
  ['boards.eu.greenhouse.io', 'Greenhouse EU boards are not supported yet.'],
  ['jobs.eu.lever.co', 'Lever EU boards are not supported yet.'],
]);
const notRecognized =
  'This link is not a Greenhouse, Ashby, Lever, Comeet or Workable job posting.';
const fail = (reason: string): JobLinkRecognition => ({ recognized: false, reason });

function found(
  provider: JobProvider,
  board: string,
  rawId: string,
  extra: { url?: string; token?: string } = {},
): JobLinkRecognition {
  // UUIDs are case-insensitive; Greenhouse, Comeet and Workable IDs keep their case.
  const jobId = provider === 'ashby' || provider === 'lever' ? rawId.toLowerCase() : rawId;
  if (!isJobLinkBoard(provider, board) || (provider === 'greenhouse' && board === 'embed'))
    return fail(
      provider === 'comeet'
        ? 'The Comeet company UID in this link is not valid.'
        : `The ${jobProviderLabels[provider]} board name in this link is not valid.`,
    );
  if (!isJobLinkId(provider, jobId))
    return fail(`The ${jobProviderLabels[provider]} job ID in this link is not valid.`);
  const url = extra.url ?? own(hostedUrl, provider)!(board, jobId);
  return {
    recognized: true,
    link: { provider, board, jobId, url, ...(extra.token ? { token: extra.token } : {}) },
  };
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
    const token = query.get('token');
    if (token !== null && ghJid !== null && token !== ghJid)
      return fail('This link names two different Greenhouse jobs.');
    const id = token ?? ghJid;
    return board && id ? found('greenhouse', board, id) : fail(notRecognized);
  }
  // boards.greenhouse.io/{board}?gh_jid={id}
  if (segments.length === 1 && ghJid !== null) return found('greenhouse', segments[0]!, ghJid);
  return fail('This Greenhouse link does not point to a single job posting.');
}

function comeetHosted(segments: string[]): JobLinkRecognition {
  // www.comeet.com/jobs/{company-name}/{companyUid}/{title-slug}/{positionUid}
  const [jobs, name, uid, title, position] = segments;
  if (
    segments.length !== 5 ||
    jobs !== 'jobs' ||
    !comeetSlugSegment.test(name!) ||
    !comeetSlugSegment.test(title!)
  )
    return fail('This Comeet link does not point to a single job posting.');
  return found('comeet', uid!, position!, {
    url: `https://www.comeet.com/jobs/${name}/${uid}/${title}/${position}`,
  });
}

function comeetEmbed(segments: string[], query: URLSearchParams): JobLinkRecognition {
  // www.comeet.co/jobs/{companyUid}/{positionUid}[/apply]?token=...
  const shape =
    segments[0] === 'jobs' &&
    (segments.length === 3 || (segments.length === 4 && segments[3] === 'apply'));
  if (!shape) return fail('This Comeet link does not point to a single job posting.');
  const token = query.get('token');
  // The token is checked but never echoed: reasons stay generic.
  if (token !== null && !comeetTokenPattern.test(token))
    return fail('The Comeet token in this link is not valid.');
  return found('comeet', segments[1]!, segments[2]!, token ? { token } : {});
}

function workable(segments: string[]): JobLinkRecognition {
  // apply.workable.com/{account}/j/{shortcode}[/apply]
  if (segments[0] === 'j')
    return fail(
      "This short Workable link does not name the company account. Open the job from the company's Workable jobs page and paste that link.",
    );
  if (
    segments[1] === 'j' &&
    (segments.length === 3 || (segments.length === 4 && segments[3] === 'apply'))
  )
    return found('workable', segments[0]!, segments[2]!);
  return fail('This Workable link does not point to a single job posting.');
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
 * Split the raw path into segments. The raw path must equal the parsed path, so dot segments
 * never slip through. Only an Ashby board name may hold `%20`, which becomes a space; every
 * other percent escape, empty segment or backslash is rejected.
 */
function pathSegments(raw: string, authority: string, url: URL): string[] | null {
  const rawPath = raw.slice(authority.length).split(/[?#]/)[0] || '/';
  if (rawPath !== url.pathname) return null;
  const path = rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
  const segments = path ? path.slice(1).split('/') : [];
  if (url.hostname === 'jobs.ashbyhq.com' && segments[0])
    segments[0] = segments[0].replace(/%20/g, ' ');
  if (segments.some((segment) => !segment || segment.includes('%'))) return null;
  return segments;
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
  if (url.username || url.password || url.port || authority[0].slice(8).includes(':'))
    return fail(notRecognized);
  const segments = pathSegments(raw, authority[0], url);
  if (!segments) return fail(notRecognized);
  if (['for', 'gh_jid', 'token'].some((key) => url.searchParams.getAll(key).length > 1))
    return fail('This link repeats a job or board identifier. Use the original posting link.');
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
  if (comeetHostedHosts.has(host)) return comeetHosted(segments);
  if (comeetEmbedHosts.has(host)) return comeetEmbed(segments, url.searchParams);
  if (host === 'apply.workable.com') return workable(segments);
  return companyPage(url.searchParams);
}

export const jobLookupInput = z.object({ url: z.string().max(maxJobLinkLength) }).strict();
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
