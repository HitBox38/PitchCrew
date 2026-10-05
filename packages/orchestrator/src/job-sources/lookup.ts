import { postingMatches, type Board } from '@pitchcrew/board';
import {
  isJobLinkId,
  jobLookupInput,
  jobProviderLabels,
  recognizeJobLink,
  type JobLink,
  type JobLookupResult,
  type JobPosting,
  type JobProvider,
  type JobSource,
} from '@pitchcrew/core';
import { fetchBoard, type FetchLike, type ProviderRateLimiter } from './fetch.ts';
import { assertSlug, parsePostings, sourceEndpoint } from './providers.ts';

/** A lookup waits behind any running scan's provider spacing, then makes one request. */
export const lookupDeadlineMs = 60_000;

/**
 * Fixed official single-posting endpoints. Only the validated board name and job ID vary.
 * Providers without one are read through their board endpoint and the posting is picked by ID.
 */
const singlePosting: Partial<
  Record<
    JobProvider,
    {
      origin: string;
      path: (board: string, id: string) => string;
      query: string;
      wrap: (body: unknown) => unknown;
    }
  >
> = {
  greenhouse: {
    origin: 'https://boards-api.greenhouse.io',
    path: (board, id) => `/v1/boards/${board}/jobs/${id}`,
    query: '?content=true',
    wrap: (body) => ({ jobs: [body] }),
  },
  lever: {
    origin: 'https://api.lever.co',
    path: (board, id) => `/v0/postings/${board}/${id}`,
    query: '?mode=json',
    wrap: (body) => [body],
  },
};

function assertJobId(provider: JobProvider, id: string): string {
  if (!isJobLinkId(provider, id)) throw new Error('Invalid job ID.');
  return id;
}
/** The one URL a lookup may request: a fixed template, or the provider's board endpoint. */
export function postingEndpoint(link: Pick<JobLink, 'provider' | 'board' | 'jobId'>): URL {
  const template = singlePosting[link.provider];
  if (!template) return sourceEndpoint(link.provider, link.board);
  const path = template.path(
    encodeURIComponent(assertSlug(link.board)),
    encodeURIComponent(assertJobId(link.provider, link.jobId)),
  );
  const url = new URL(`${template.origin}${path}${template.query}`);
  // Defense in depth: the parsed URL must still be exactly the fixed template.
  if (url.origin !== template.origin || url.pathname !== path || url.search !== template.query)
    throw new Error('Invalid job link.');
  return url;
}

/** Title-case a board name, used when neither a saved source nor the provider names the company. */
export function companyFromBoard(board: string): string {
  return board
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ')
    .slice(0, 100);
}
function providerCompany(body: unknown): string {
  const value =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).company_name
      : undefined;
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 100) : '';
}

export interface LookupDependencies {
  fetch: FetchLike;
  limiter: ProviderRateLimiter;
  board: Board;
  sources: () => Promise<JobSource[]>;
  signal: AbortSignal;
  /** Per-request timeout; defaults to the discovery request timeout. */
  timeoutMs?: number;
}

async function readPosting(
  link: JobLink,
  { fetch, limiter, signal, timeoutMs }: LookupDependencies,
): Promise<{ posting: JobPosting; company: string }> {
  const label = jobProviderLabels[link.provider];
  const url = postingEndpoint(link);
  let status = 0;
  const observed: FetchLike = async (target, init) => {
    const response = await fetch(target, init);
    status = response.status;
    return response;
  };
  let body: unknown;
  try {
    body = await limiter.schedule(
      link.provider,
      () => fetchBoard(observed, url, { signal, ...(timeoutMs ? { timeoutMs } : {}) }),
      signal,
    );
  } catch (error) {
    if (status === 404)
      throw new Error(
        singlePosting[link.provider]
          ? `This ${label} posting was not found. It may be closed, or the link may be wrong.`
          : `This ${label} board was not found. Check the link.`,
      );
    throw error;
  }
  const template = singlePosting[link.provider];
  const postings = parsePostings(link.provider, link.board, template ? template.wrap(body) : body);
  const posting = postings.find((item) => item.jobId.toLowerCase() === link.jobId);
  if (!posting)
    throw new Error(
      template
        ? `The ${label} response did not include this posting.`
        : `This posting is not on the public ${label} board. It may be closed.`,
    );
  return { posting, company: template ? providerCompany(body) : '' };
}

/**
 * Read one posting from a pasted link and return form values for the user to review. Creates
 * nothing. Unrecognized links and provider failures are results, not errors.
 */
export async function lookupJobLink(
  value: unknown,
  dependencies: Omit<LookupDependencies, 'signal'> & { signal?: AbortSignal },
): Promise<JobLookupResult> {
  const { url } = jobLookupInput.parse(value);
  const recognition = recognizeJobLink(url);
  if (!recognition.recognized) return { status: 'unrecognized', reason: recognition.reason };
  const { link } = recognition;
  const deadline = AbortSignal.timeout(lookupDeadlineMs);
  const signal = AbortSignal.any([deadline, ...(dependencies.signal ? [dependencies.signal] : [])]);
  let read: Awaited<ReturnType<typeof readPosting>>;
  try {
    read = await readPosting(link, { ...dependencies, signal });
  } catch (error) {
    const reason = dependencies.signal?.aborted
      ? 'The lookup was cancelled.'
      : deadline.aborted
        ? 'The job board took too long to answer. Try again later.'
        : error instanceof Error
          ? error.message
          : 'Could not read the job posting.';
    return { status: 'failed', reason: reason.slice(0, 500) };
  }
  const { posting } = read;
  const saved = (await dependencies.sources()).find(
    (source) =>
      source.provider === link.provider && source.slug.toLowerCase() === link.board.toLowerCase(),
  );
  const company = saved?.name ?? (read.company || companyFromBoard(link.board));
  const duplicates = postingMatches(dependencies.board, {
    provider: link.provider,
    slug: link.board,
    jobId: posting.jobId,
    company,
    title: posting.title,
    urls: [posting.url, url, link.url],
  });
  return {
    status: 'found',
    prefill: {
      company,
      title: posting.title.slice(0, 160),
      location: posting.location.slice(0, 120),
      url: posting.url,
      salary: posting.salary.slice(0, 100),
      description: posting.description.slice(0, 20_000),
      jobIdentifier: posting.jobId,
      provenance: {
        provider: link.provider,
        board: link.board,
        jobId: posting.jobId,
        postedAt: posting.postedAt,
      },
    },
    duplicates: duplicates.map(({ id, company, title, state }) => ({ id, company, title, state })),
  };
}
