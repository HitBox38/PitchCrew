import { postingMatches, type Board } from '@pitchcrew/board';
import {
  isJobLinkId,
  jobLookupInput,
  jobProviderNeedsToken,
  jobProviderLabels,
  recognizeJobLink,
  type JobLink,
  type JobLookupResult,
  type JobPosting,
  type JobProvider,
  type JobSource,
} from '@pitchcrew/core';
import { fetchBoard, type FetchLike, type ProviderRateLimiter } from './fetch.ts';
import {
  assertSlug,
  parsePostings,
  providerStatusMessages,
  redactToken,
  sourceEndpoint,
} from './providers.ts';

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
/**
 * The one URL a lookup may request: a fixed single-posting template, or the provider's board
 * endpoint built exactly as scans build it (so Ashby names are encoded the same way).
 */
export function postingEndpoint(
  link: Pick<JobLink, 'provider' | 'board' | 'jobId'>,
  token?: string,
): URL {
  const template = singlePosting[link.provider];
  if (!template) return sourceEndpoint(link.provider, link.board, token);
  const path = template.path(
    encodeURIComponent(assertSlug(link.board, link.provider)),
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
    .split(/[-_. ]+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ')
    .slice(0, 100);
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const name = (value: unknown, token?: string) =>
  typeof value === 'string'
    ? redactToken(value, token).replace(/\s+/g, ' ').trim().slice(0, 100)
    : '';
/** The company name a provider response carries, if any. */
function providerCompany(
  provider: JobProvider,
  body: unknown,
  jobId: string,
  token?: string,
): string {
  if (provider === 'greenhouse') return name(record(body).company_name, token);
  if (provider === 'workable') return name(record(body).name, token);
  if (provider === 'comeet' && Array.isArray(body))
    return name(
      record(
        body.find((item) => {
          const uid = record(item).uid;
          return typeof uid === 'string' && uid.split('-')[0] === jobId;
        }),
      ).company_name,
      token,
    );
  return '';
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
const sameBoard = (source: JobSource, link: JobLink) =>
  source.provider === link.provider && source.slug.toLowerCase() === link.board.toLowerCase();
export const comeetSourceNeeded =
  'Add this company as a Comeet source in Settings > Job sources to fetch its postings.';

async function readPosting(
  link: JobLink,
  token: string | undefined,
  { fetch, limiter, signal, timeoutMs }: LookupDependencies,
): Promise<{ posting: JobPosting; company: string }> {
  const label = jobProviderLabels[link.provider];
  const template = singlePosting[link.provider];
  const statusMessages = providerStatusMessages[link.provider];
  let status = 0;
  const observed: FetchLike = async (target, init) => {
    const response = await fetch(target, init);
    status = response.status;
    return response;
  };
  let body: unknown;
  try {
    const url = postingEndpoint(link, token);
    body = await limiter.schedule(
      link.provider,
      () =>
        fetchBoard(observed, url, {
          signal,
          statusMessages,
          ...(timeoutMs ? { timeoutMs } : {}),
        }),
      signal,
    );
  } catch (error) {
    if (status === 404 && !statusMessages?.[404])
      throw new Error(
        template
          ? `This ${label} posting was not found. It may be closed, or the link may be wrong.`
          : `This ${label} board was not found. Check the link.`,
      );
    // Errors reach the UI; never echo a careers token.
    throw new Error(
      redactToken(
        error instanceof Error ? error.message : 'Could not read the job posting.',
        token,
      ),
    );
  }
  const postings = parsePostings(
    link.provider,
    link.board,
    template ? template.wrap(body) : body,
    token,
  );
  const wanted = link.jobId.toLowerCase();
  const posting = postings.find((item) => item.jobId.toLowerCase() === wanted);
  if (!posting)
    throw new Error(
      template
        ? `The ${label} response did not include this posting.`
        : `This posting is not on the public ${label} board. It may be closed.`,
    );
  return { posting, company: providerCompany(link.provider, body, posting.jobId, token) };
}

/**
 * Read one posting from a pasted link and return form values for the user to review. Creates
 * nothing. Unrecognized links and provider failures are results, not errors. A Comeet token from
 * an embed link is used for this lookup only; no token appears in the result.
 */
export async function lookupJobLink(
  value: unknown,
  dependencies: Omit<LookupDependencies, 'signal'> & { signal?: AbortSignal },
): Promise<JobLookupResult> {
  const { url } = jobLookupInput.parse(value);
  const recognition = recognizeJobLink(url);
  if (!recognition.recognized) return { status: 'unrecognized', reason: recognition.reason };
  const { link } = recognition;
  const saved = (await dependencies.sources()).find((source) => sameBoard(source, link));
  const token = link.token ?? saved?.token;
  if (jobProviderNeedsToken(link.provider) && !token)
    return { status: 'failed', reason: comeetSourceNeeded };
  const deadline = AbortSignal.timeout(lookupDeadlineMs);
  const signal = AbortSignal.any([deadline, ...(dependencies.signal ? [dependencies.signal] : [])]);
  let read: Awaited<ReturnType<typeof readPosting>>;
  try {
    read = await readPosting(link, token, { ...dependencies, signal });
  } catch (error) {
    const reason = dependencies.signal?.aborted
      ? 'The lookup was cancelled.'
      : deadline.aborted
        ? 'The job board took too long to answer. Try again later.'
        : error instanceof Error
          ? error.message
          : 'Could not read the job posting.';
    return { status: 'failed', reason: redactToken(reason, token).slice(0, 500) };
  }
  const { posting } = read;
  const company = redactToken(saved?.name ?? (read.company || companyFromBoard(link.board)), token);
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
    duplicates: duplicates.map(({ id, company, title, state }) => ({
      id,
      company: redactToken(company, token),
      title: redactToken(title, token),
      state,
    })),
  };
}
