import { jobSourceInput, type JobPosting } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import {
  fetchBoard,
  ProviderRateLimiter,
  userAgent,
  type FetchLike,
} from '../src/job-sources/fetch.ts';
import { matchesFilters } from '../src/job-sources/filters.ts';
import { decodeEntities, htmlToText } from '../src/job-sources/html.ts';
import { parsePostings, sourceEndpoint } from '../src/job-sources/providers.ts';
import { boardFixture, fixtureUrls, jsonResponse } from './helpers/job-boards.ts';

const posting = (patch: Partial<JobPosting> = {}): JobPosting => ({
  provider: 'greenhouse',
  jobId: '1',
  title: 'Senior Frontend Engineer',
  location: 'Lisbon, Portugal',
  remote: false,
  url: 'https://job-boards.greenhouse.io/northwindlabs/jobs/1',
  description: '',
  salary: '',
  postedAt: null,
  ...patch,
});
const filters = (patch = {}) => ({
  titleInclude: [],
  titleExclude: [],
  locationInclude: [],
  remoteOnly: false,
  ...patch,
});

describe('provider parsers', () => {
  it('reads Greenhouse jobs, unescapes content once and tolerates missing fields', () => {
    const postings = parsePostings('greenhouse', 'northwindlabs', boardFixture('greenhouse'));
    expect(postings.map((item) => item.jobId)).toEqual([
      '4010001001',
      '4010001002',
      '4010001003',
      '4010001004',
    ]);
    const [first, , , sparse] = postings;
    expect(first).toMatchObject({
      provider: 'greenhouse',
      title: 'Senior Frontend Engineer',
      location: 'Remote - United States',
      remote: true,
      url: 'https://job-boards.greenhouse.io/northwindlabs/jobs/4010001001',
      postedAt: '2026-09-20T13:00:00.000Z',
      salary: '',
    });
    expect(first.description).toContain('Northwind Labs builds fictional logistics tools.');
    expect(first.description).toContain('- Improve accessibility & performance');
    expect(first.description).toContain('Read our values.');
    expect(first.description).not.toMatch(/alert|tracker\.example|<|onerror/);
    expect(sparse).toMatchObject({
      title: 'Data Analyst',
      location: '',
      description: '',
      remote: false,
      url: 'https://job-boards.greenhouse.io/northwindlabs/jobs/4010001004',
    });
  });

  it('reads Ashby postings, skips unlisted jobs and derives a missing ID from jobUrl', () => {
    const postings = parsePostings('ashby', 'fabrikam', boardFixture('ashby'));
    expect(postings).toHaveLength(2);
    expect(postings[0]).toMatchObject({
      jobId: '6f1c2b3a-1111-4c3d-9e8f-0a1b2c3d4e5f',
      title: 'Product Designer',
      location: 'Berlin; Remote (EU)',
      remote: true,
      salary: '€70K - €85K',
      description: 'Design fictional billing flows.\n\n- Prototype\n- Research',
      postedAt: '2026-09-22T12:00:00.000Z',
    });
    expect(postings[1]).toMatchObject({
      jobId: '7a2d3c4b-2222-4d5e-8f90-1a2b3c4d5e6f',
      remote: true,
      url: 'https://jobs.ashbyhq.com/fabrikam/7a2d3c4b-2222-4d5e-8f90-1a2b3c4d5e6f',
      description: 'Own fictional payments services.',
    });
  });

  it('reads Lever postings with lists and salary, replacing unsafe URLs with the hosted page', () => {
    const postings = parsePostings('lever', 'contoso-robotics', boardFixture('lever'));
    expect(postings).toHaveLength(2);
    expect(postings[0]).toMatchObject({
      jobId: 'a1b2c3d4-0001-4a5b-8c9d-0e1f2a3b4c5d',
      title: 'Backend Engineer',
      location: 'Remote - Canada',
      remote: true,
      salary: 'CAD 120,000-150,000 per year salary',
      postedAt: '2025-09-24T08:00:00.000Z',
    });
    expect(postings[0].description).toContain("What you'll do\n\n- Build APIs\n- Run services");
    expect(postings[0].description).toContain('Fictional benefits: learning budget.');
    expect(postings[1]).toMatchObject({
      remote: false,
      url: 'https://jobs.lever.co/contoso-robotics/a1b2c3d4-0002-4a5b-8c9d-0e1f2a3b4c5d',
    });
  });

  it('rejects responses with an unexpected shape', () => {
    expect(() => parsePostings('lever', 'acme', { jobs: [] })).toThrow('unexpected');
    expect(() => parsePostings('greenhouse', 'acme', [])).toThrow('unexpected');
    expect(() => parsePostings('ashby', 'acme', null)).toThrow('unexpected');
  });
});

describe('HTML conversion', () => {
  it('drops markup, scripts, styles, comments and link targets without executing anything', () => {
    const text = htmlToText(
      '<h2>Role</h2><!-- <p>hidden</p> --><p>Hello&nbsp;<a href="javascript:alert(1)">team</a></p><script>document.cookie</script><style>body{}</style><iframe src="https://x.invalid"></iframe><p>Pay &#36;10 &#x41; &bogus; &#0;</p>',
    );
    expect(text).toBe('Role\n\nHello team\n\nPay $10 A &bogus;');
  });

  it('is linear on unterminated tags and bounds its output', () => {
    expect(htmlToText(`<p>${'<'.repeat(100_000)}`)).toBe('');
    expect(htmlToText(`<script>${'a'.repeat(1000)}`)).toBe('');
    expect(htmlToText(`<p>${'word '.repeat(10_000)}</p>`).length).toBeLessThanOrEqual(20_000);
    expect(decodeEntities('&#xD800;&#1114112;&lt;')).toBe('  <');
  });
});

describe('filters', () => {
  it('applies include, exclude, location and remote rules case-insensitively', () => {
    expect(matchesFilters(posting(), filters())).toBe(true);
    expect(matchesFilters(posting(), filters({ titleInclude: ['frontend', 'design'] }))).toBe(true);
    expect(matchesFilters(posting(), filters({ titleInclude: ['backend'] }))).toBe(false);
    expect(matchesFilters(posting(), filters({ titleExclude: ['SENIOR'] }))).toBe(false);
    expect(matchesFilters(posting(), filters({ locationInclude: ['lisbon'] }))).toBe(true);
    expect(matchesFilters(posting(), filters({ locationInclude: ['berlin'] }))).toBe(false);
    expect(matchesFilters(posting(), filters({ remoteOnly: true }))).toBe(false);
    expect(matchesFilters(posting({ remote: true }), filters({ remoteOnly: true }))).toBe(true);
  });
});

describe('endpoints and board names', () => {
  it('builds only the fixed official endpoints', () => {
    expect(sourceEndpoint('greenhouse', 'northwindlabs').toString()).toBe(fixtureUrls.greenhouse);
    expect(sourceEndpoint('ashby', 'fabrikam').toString()).toBe(fixtureUrls.ashby);
    expect(sourceEndpoint('lever', 'contoso-robotics').toString()).toBe(fixtureUrls.lever);
  });

  it.each([
    '',
    '../admin',
    'acme/../../v1',
    'acme/jobs',
    'acme?x=1',
    'acme#frag',
    'acme%2Fjobs',
    'acme.example',
    '.acme',
    '-acme',
    'acme jobs',
    'acme\njobs',
    'https://evil.example',
    '@evil.example',
    'éacme',
    'a'.repeat(81),
  ])('rejects the board name %j', (slug) => {
    expect(() => sourceEndpoint('greenhouse', slug)).toThrow('Invalid job board name.');
    expect(jobSourceInput.safeParse({ provider: 'lever', slug, name: 'Acme' }).success).toBe(false);
  });

  it('rejects unknown providers and extra source fields such as URLs', () => {
    expect(() => sourceEndpoint('workday' as never, 'acme')).toThrow();
    expect(
      jobSourceInput.safeParse({
        provider: 'lever',
        slug: 'acme',
        name: 'Acme',
        url: 'https://evil.example',
      }).success,
    ).toBe(false);
  });
});

describe('bounded fetch', () => {
  const url = sourceEndpoint('lever', 'contoso-robotics');

  it('sends a credential-free GET with no redirects and a descriptive user agent', async () => {
    let seen: RequestInit | undefined;
    const fetcher: FetchLike = async (_url, init) => {
      seen = init;
      return jsonResponse([]);
    };
    await expect(fetchBoard(fetcher, url)).resolves.toEqual([]);
    expect(seen).toMatchObject({ method: 'GET', redirect: 'error', credentials: 'omit' });
    expect(seen?.headers).toEqual({ accept: 'application/json', 'user-agent': userAgent });
    expect(JSON.stringify(seen)).not.toMatch(/authorization|cookie/i);
  });

  it('rejects declared and streamed bodies above the size cap', async () => {
    const declared: FetchLike = async () =>
      new Response('[]', {
        headers: { 'content-type': 'application/json', 'content-length': '999999999' },
      });
    await expect(fetchBoard(declared, url)).rejects.toThrow('too large');
    const streamed: FetchLike = async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.enqueue(new TextEncoder().encode('x'.repeat(1024)));
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    await expect(fetchBoard(streamed, url, { maxBytes: 10_000 })).rejects.toThrow('too large');
  });

  it('times out stalled requests and stalled bodies', async () => {
    const stalled: FetchLike = () => new Promise(() => {});
    await expect(fetchBoard(stalled, url, { timeoutMs: 30 })).rejects.toThrow('timed out');
    const slowBody: FetchLike = async () =>
      new Response(new ReadableStream({ pull: () => new Promise(() => {}) }), {
        headers: { 'content-type': 'application/json' },
      });
    await expect(fetchBoard(slowBody, url, { timeoutMs: 30 })).rejects.toThrow('timed out');
  });

  it('reports missing boards, rate limits, non-JSON and invalid JSON', async () => {
    await expect(fetchBoard(async () => jsonResponse({}, 404), url)).rejects.toThrow('not found');
    await expect(fetchBoard(async () => jsonResponse({}, 429), url)).rejects.toThrow(
      'rate limiting',
    );
    await expect(fetchBoard(async () => jsonResponse({}, 500), url)).rejects.toThrow('HTTP 500');
    await expect(
      fetchBoard(
        async () => new Response('<html>', { headers: { 'content-type': 'text/html' } }),
        url,
      ),
    ).rejects.toThrow('did not return JSON');
    await expect(
      fetchBoard(
        async () => new Response('{', { headers: { 'content-type': 'application/json' } }),
        url,
      ),
    ).rejects.toThrow('invalid JSON');
  });

  it('spaces requests to one provider without delaying other providers', async () => {
    const limiter = new ProviderRateLimiter(80);
    const started: Record<string, number> = {};
    const start = Date.now();
    await Promise.all([
      limiter.schedule('lever', async () => (started.first = Date.now() - start)),
      limiter.schedule('lever', async () => (started.second = Date.now() - start)),
      limiter.schedule('ashby', async () => (started.other = Date.now() - start)),
    ]);
    expect(started.second! - started.first!).toBeGreaterThanOrEqual(70);
    expect(started.other!).toBeLessThan(60);
  });
});
