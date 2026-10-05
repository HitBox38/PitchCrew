import { jobSourceInput, type JobPosting } from '@pitchcrew/core';
import { describe, expect, it, vi } from 'vitest';
import {
  fetchBoard,
  ProviderRateLimiter,
  userAgent,
  type FetchLike,
} from '../src/job-sources/fetch.ts';
import { matchesFilters } from '../src/job-sources/filters.ts';
import { decodeEntities, htmlToText } from '../src/job-sources/html.ts';
import {
  parsePostings,
  providerStatusMessages,
  redactToken,
  sourceEndpoint,
} from '../src/job-sources/providers.ts';
import {
  boardFixture,
  comeetFixtureToken,
  fixtureUrls,
  jsonResponse,
  moreFixtureUrls,
} from './helpers/job-boards.ts';

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

  it('reads Comeet positions, merges office copies and skips internal or untitled ones', () => {
    const postings = parsePostings('comeet', 'A1.B2C', boardFixture('comeet'));
    expect(postings.map((item) => item.jobId)).toEqual(['A1.00D', 'A1.00E', 'A1.011', 'A1.012']);
    const [first, remote, sparse, unsafe] = postings;
    expect(first).toMatchObject({
      provider: 'comeet',
      title: 'Senior Backend Engineer',
      location: 'Tel Aviv, Israel; Haifa, Israel',
      remote: false,
      url: 'https://www.comeet.com/jobs/wingtip-analytics/A1.B2C/senior-backend-engineer/A1.00D',
      salary: '',
      postedAt: '2026-09-25T08:30:00.000Z',
    });
    // Sections follow Comeet's order; markup, scripts and link targets are dropped.
    expect(first.description).toBe(
      'Description\n\nWingtip Analytics builds fictional analytics.\n\nRead more\n\nRequirements\n\n- Node.js & SQL\n- Five years building services',
    );
    // Unsafe links and anything that looks like the careers API are never used as posting URLs.
    expect(remote).toMatchObject({
      location: 'Remote',
      remote: true,
      url: 'https://www.comeet.com/jobs/wingtip-analytics/A1.B2C/product-manager/A1.00E',
      description: '',
      postedAt: null,
    });
    expect(JSON.stringify(postings)).not.toContain(comeetFixtureToken);
    expect(sparse).toMatchObject({
      title: 'QA Engineer',
      location: '',
      remote: false,
      url: 'https://www.comeet.com/jobs/company/A1.B2C/qa-engineer/A1.011',
    });
    expect(unsafe).toMatchObject({
      location: 'Lisbon, PT',
      remote: true,
      url: 'https://careers.wingtip.example/jobs/data-scientist',
      postedAt: null,
    });
  });

  it('reads Workable jobs, merges per-location copies and falls back to the hosted page', () => {
    const postings = parsePostings('workable', 'litware', boardFixture('workable'));
    expect(postings.map((item) => item.jobId)).toEqual(['3F2A1B0C9D', '5C6D7E8F90', '7A8B9C0D1E']);
    const [first, remote, sparse] = postings;
    expect(first).toMatchObject({
      provider: 'workable',
      title: 'Frontend Developer',
      location: 'Athens, Attica, Greece; Thessaloniki, Greece',
      remote: false,
      url: 'https://apply.workable.com/j/3F2A1B0C9D',
      postedAt: '2026-09-21T00:00:00.000Z',
    });
    expect(first.description).toBe(
      'Build fictional creative tools.\n\nRequirements\n\n- React\n- Accessibility\n\nBenefits\n\nFictional perks.',
    );
    expect(remote).toMatchObject({
      location: 'Portugal',
      remote: true,
      url: 'https://apply.workable.com/litware/j/5C6D7E8F90/',
      postedAt: '2026-09-18T00:00:00.000Z',
    });
    expect(sparse).toMatchObject({
      location: 'Berlin, Berlin, Germany',
      remote: false,
      description: '',
      postedAt: null,
    });
  });

  it('rejects responses with an unexpected shape', () => {
    expect(() => parsePostings('lever', 'acme', { jobs: [] })).toThrow('unexpected');
    expect(() => parsePostings('greenhouse', 'acme', [])).toThrow('unexpected');
    expect(() => parsePostings('ashby', 'acme', null)).toThrow('unexpected');
    expect(() => parsePostings('comeet', 'A1.B2C', { jobs: [] })).toThrow('unexpected');
    expect(() => parsePostings('workable', 'acme', [])).toThrow('unexpected');
    expect(parsePostings('comeet', 'A1.B2C', [null, 'x', 7])).toEqual([]);
    expect(parsePostings('workable', 'acme', { jobs: [null, { shortcode: 'A' }] })).toEqual([]);
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

  it('applies the same rules to Comeet and Workable postings, including every merged office', () => {
    const [comeet] = parsePostings('comeet', 'A1.B2C', boardFixture('comeet'));
    const [workable, remote] = parsePostings('workable', 'litware', boardFixture('workable'));
    expect(matchesFilters(comeet!, filters({ locationInclude: ['haifa'] }))).toBe(true);
    expect(matchesFilters(comeet!, filters({ titleInclude: ['backend'] }))).toBe(true);
    expect(matchesFilters(comeet!, filters({ remoteOnly: true }))).toBe(false);
    expect(matchesFilters(workable!, filters({ locationInclude: ['thessaloniki'] }))).toBe(true);
    expect(matchesFilters(workable!, filters({ titleExclude: ['frontend'] }))).toBe(false);
    expect(matchesFilters(remote!, filters({ remoteOnly: true }))).toBe(true);
  });
});

describe('endpoints and board names', () => {
  it('builds only the fixed official endpoints', () => {
    expect(sourceEndpoint('greenhouse', 'northwindlabs').toString()).toBe(fixtureUrls.greenhouse);
    expect(sourceEndpoint('ashby', 'fabrikam').toString()).toBe(fixtureUrls.ashby);
    expect(sourceEndpoint('lever', 'contoso-robotics').toString()).toBe(fixtureUrls.lever);
    expect(sourceEndpoint('comeet', 'A1.B2C', comeetFixtureToken).toString()).toBe(
      moreFixtureUrls.comeet,
    );
    expect(sourceEndpoint('workable', 'litware').toString()).toBe(moreFixtureUrls.workable);
  });

  it.each([
    '',
    'A1',
    'A1.',
    '.B2C',
    '..',
    'A1..B2',
    'A1.B2.C3',
    'A1/B2',
    'A1.B2C/../x',
    'A1.B2C?token=x',
    'A1.B2C#x',
    'A1%2EB2C',
    'A1.B2 C',
    'A1.B2C\nx',
    'é1.B2C',
    'A123456789.B2C',
  ])('rejects the Comeet company UID %j', (slug) => {
    expect(() => sourceEndpoint('comeet', slug, comeetFixtureToken)).toThrow(
      'Invalid job board name.',
    );
    expect(
      jobSourceInput.safeParse({
        provider: 'comeet',
        slug,
        token: comeetFixtureToken,
        name: 'Wingtip',
      }).success,
    ).toBe(false);
  });

  it.each([
    undefined,
    '',
    'short',
    'Fictional Token 123',
    'FictionalToken&details=false',
    'FictionalToken0123#x',
    'FictionalToken0123/../x',
    'FictionalToken%26x=1',
    'Fictional\nToken0123',
    'x'.repeat(129),
  ])('rejects the Comeet token %j without echoing it', (token) => {
    expect(() => sourceEndpoint('comeet', 'A1.B2C', token)).toThrow('Invalid careers token.');
    const parsed = jobSourceInput.safeParse({
      provider: 'comeet',
      slug: 'A1.B2C',
      name: 'Wingtip',
      ...(token === undefined ? {} : { token }),
    });
    expect(parsed.success).toBe(false);
    if (token) expect(parsed.error!.message).not.toContain(token);
  });

  it('accepts tokens only for Comeet and keeps old source files valid', () => {
    expect(() => sourceEndpoint('workable', 'litware', comeetFixtureToken)).toThrow('token');
    expect(() => sourceEndpoint('greenhouse', 'acme', '')).toThrow('token');
    expect(
      jobSourceInput.safeParse({
        provider: 'workable',
        slug: 'litware',
        name: 'Litware',
        token: comeetFixtureToken,
      }).success,
    ).toBe(false);
    expect(() => sourceEndpoint('workable', 'A1.B2C')).toThrow('Invalid job board name.');
    // A source saved before Comeet existed has no token field and parses unchanged.
    expect(
      jobSourceInput.parse({ provider: 'lever', slug: 'contoso-robotics', name: 'Contoso' }),
    ).not.toHaveProperty('token');
    expect(
      jobSourceInput.parse({
        provider: 'comeet',
        slug: ' A1.B2C ',
        token: ` ${comeetFixtureToken} `,
        name: 'Wingtip',
      }),
    ).toMatchObject({ slug: 'A1.B2C', token: comeetFixtureToken });
  });

  it('hides the careers token in error text', () => {
    expect(redactToken(`GET ${moreFixtureUrls.comeet} failed`, comeetFixtureToken)).toBe(
      'GET https://www.comeet.co/careers-api/2.0/company/A1.B2C/positions?details=true&token=[token] failed',
    );
    expect(redactToken('No token here', undefined)).toBe('No token here');
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

  it('explains rejected Comeet credentials and unknown Workable accounts', async () => {
    const comeet = sourceEndpoint('comeet', 'A1.B2C', comeetFixtureToken);
    const statusMessages = providerStatusMessages.comeet!;
    await expect(
      fetchBoard(async () => jsonResponse({ error: 'invalid' }, 400), comeet, { statusMessages }),
    ).rejects.toThrow('Comeet did not accept the company UID and token.');
    await expect(
      fetchBoard(async () => jsonResponse({}, 404), sourceEndpoint('workable', 'litware'), {
        statusMessages: providerStatusMessages.workable!,
      }),
    ).rejects.toThrow('Workable account not found.');
    await expect(
      fetchBoard(async () => jsonResponse({}, 500), comeet, { statusMessages }),
    ).rejects.toThrow('HTTP 500');
  });

  it('cancels queued provider requests without starting them', async () => {
    const limiter = new ProviderRateLimiter(1000);
    await limiter.schedule('lever', async () => {});
    const controller = new AbortController();
    const task = vi.fn(async () => {});
    const queued = limiter.schedule('lever', task, controller.signal);
    const stopped = expect(queued).rejects.toThrow();
    controller.abort();
    await stopped;
    expect(task).not.toHaveBeenCalled();
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
