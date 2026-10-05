import { Board } from '@pitchcrew/board';
import {
  currentEventVersion,
  decodeEvent,
  type Card,
  type JobLookupResult,
  type JobScanSummary,
  type JobSource,
  type Run,
} from '@pitchcrew/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ProviderRateLimiter, userAgent, type FetchLike } from '../src/job-sources/fetch.ts';
import {
  comeetSourceNeeded,
  companyFromBoard,
  lookupJobLink,
  postingEndpoint,
} from '../src/job-sources/lookup.ts';
import { cleanup, setup } from './helpers/daemon.ts';
import {
  comeetFixtureToken,
  fixtureSources,
  jsonResponse,
  moreFixtureSources,
} from './helpers/job-boards.ts';
import { ashbyJobId, leverJobId, postingLinks, recordedPostings } from './helpers/job-links.ts';

afterEach(cleanup);

const found = (result: JobLookupResult) => {
  if (result.status !== 'found') throw new Error(`Lookup ${result.status}: ${result.reason}`);
  return result;
};
const reasonOf = (result: JobLookupResult) => {
  if (result.status === 'found') throw new Error('Lookup unexpectedly found a posting.');
  return result;
};

/** Run a lookup against a temporary board without starting the daemon. */
async function withBoard<T>(run: (board: Board) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-test-'));
  if (!resolve(directory).startsWith(resolve(tmpdir(), 'pitchcrew-test-')))
    throw new Error('Refusing unsafe cleanup target.');
  const board = new Board(join(directory, 'board.db'));
  try {
    return await run(board);
  } finally {
    board.close();
    await rm(directory, { recursive: true, force: true });
  }
}
const lookup = (board: Board, url: string, fetcher: FetchLike, extra = {}) =>
  lookupJobLink(
    { url },
    {
      fetch: fetcher,
      limiter: new ProviderRateLimiter(0),
      board,
      sources: async () => [],
      ...extra,
    },
  );

describe('single posting endpoints', () => {
  it('builds only fixed official endpoints from validated parts', () => {
    expect(
      postingEndpoint({ provider: 'greenhouse', board: 'northwindlabs', jobId: '4010001001' }).href,
    ).toBe(postingLinks.greenhouse.endpoint);
    expect(
      postingEndpoint({ provider: 'lever', board: 'contoso-robotics', jobId: leverJobId }).href,
    ).toBe(postingLinks.lever.endpoint);
    // Ashby has no public single-posting endpoint, so the board is read instead.
    expect(postingEndpoint({ provider: 'ashby', board: 'fabrikam', jobId: ashbyJobId }).href).toBe(
      postingLinks.ashby.endpoint,
    );
    for (const [board, jobId] of [
      ['../v1', '4010001001'],
      ['acme', '1/../../admin'],
      ['acme', '1?x=1'],
      ['acme', leverJobId],
    ])
      expect(() => postingEndpoint({ provider: 'greenhouse', board, jobId })).toThrow('Invalid');
    expect(() => postingEndpoint({ provider: 'lever', board: 'acme', jobId: '123' })).toThrow();
  });

  it('names the company from the board when the provider does not', () => {
    expect(companyFromBoard('contoso-robotics')).toBe('Contoso Robotics');
    expect(companyFromBoard('fabrikam')).toBe('Fabrikam');
    expect(companyFromBoard('north_wind--labs')).toBe('North Wind Labs');
    expect(companyFromBoard('Northwind Scientific')).toBe('Northwind Scientific');
    expect(companyFromBoard('example.io')).toBe('Example Io');
  });
});

describe('posting lookups from recorded fixtures', () => {
  it('reads a Greenhouse posting through the single job endpoint', async () => {
    const { calls, fetcher } = recordedPostings();
    const result = found(
      await withBoard((board) => lookup(board, postingLinks.greenhouse.link, fetcher)),
    );
    expect(calls.map((call) => call.url)).toEqual([postingLinks.greenhouse.endpoint]);
    expect(calls[0].init).toMatchObject({
      method: 'GET',
      redirect: 'error',
      credentials: 'omit',
      headers: { accept: 'application/json', 'user-agent': userAgent },
    });
    expect(result.prefill).toMatchObject({
      company: 'Northwind Labs',
      title: 'Senior Frontend Engineer',
      location: 'Remote - United States',
      url: 'https://job-boards.greenhouse.io/northwindlabs/jobs/4010001001',
      jobIdentifier: '4010001001',
      provenance: {
        provider: 'greenhouse',
        board: 'northwindlabs',
        jobId: '4010001001',
        postedAt: '2026-09-20T13:00:00.000Z',
      },
    });
    expect(result.prefill.description).toContain('Northwind Labs builds fictional logistics');
    expect(result.prefill.description).not.toMatch(/alert|tracker\.example|</);
    expect(result.duplicates).toEqual([]);
  });

  it('reads a Lever posting through the single posting endpoint', async () => {
    const { calls, fetcher } = recordedPostings();
    const result = found(
      await withBoard((board) => lookup(board, postingLinks.lever.link, fetcher)),
    );
    expect(calls.map((call) => call.url)).toEqual([postingLinks.lever.endpoint]);
    expect(result.prefill).toMatchObject({
      company: 'Contoso Robotics',
      title: 'Backend Engineer',
      salary: 'CAD 120,000-150,000 per year salary',
      url: `https://jobs.lever.co/contoso-robotics/${leverJobId}`,
      jobIdentifier: leverJobId,
      provenance: { provider: 'lever', board: 'contoso-robotics', jobId: leverJobId },
    });
    expect(result.prefill.description).toContain('- Build APIs');
  });

  it('reads an Ashby posting by picking it from the board and prefers the saved source name', async () => {
    const { calls, fetcher } = recordedPostings();
    const sources = async () =>
      [{ ...fixtureSources.ashby, name: 'Fabrikam Payments', id: 'saved' }] as JobSource[];
    const result = found(
      await withBoard((board) => lookup(board, postingLinks.ashby.link, fetcher, { sources })),
    );
    expect(calls.map((call) => call.url)).toEqual([postingLinks.ashby.endpoint]);
    expect(result.prefill).toMatchObject({
      company: 'Fabrikam Payments',
      title: 'Product Designer',
      salary: '€70K - €85K',
      jobIdentifier: ashbyJobId,
      description: 'Design fictional billing flows.\n\n- Prototype\n- Research',
    });
  });

  it('treats unrecognized links as a normal result without any request', async () => {
    const { calls, fetcher } = recordedPostings();
    await withBoard(async (board) => {
      for (const url of [
        'https://careers.example.com/jobs/42',
        'http://boards.greenhouse.io/northwindlabs/jobs/4010001001',
        'https://jobs.lever.co/../contoso-robotics/' + leverJobId,
        'https://user@jobs.lever.co/contoso-robotics/' + leverJobId,
      ])
        expect((await lookup(board, url, fetcher)).status).toBe('unrecognized');
    });
    expect(calls).toEqual([]);
  });

  it('reports closed postings, provider errors and unexpected responses', async () => {
    await withBoard(async (board) => {
      const closed = recordedPostings({
        [postingLinks.greenhouse.endpoint]: () => jsonResponse({ status: 404 }, 404),
      });
      expect(reasonOf(await lookup(board, postingLinks.greenhouse.link, closed.fetcher))).toEqual({
        status: 'failed',
        reason:
          'This Greenhouse posting was not found. It may be closed, or the link may be wrong.',
      });
      const missingFromBoard = `https://jobs.ashbyhq.com/fabrikam/8b3e4d5c-3333-4e6f-9a01-2b3c4d5e6f70`;
      expect(
        reasonOf(await lookup(board, missingFromBoard, recordedPostings().fetcher)).reason,
      ).toBe('This posting is not on the public Ashby board. It may be closed.');
      const missingBoard = recordedPostings({
        [postingLinks.ashby.endpoint]: () => jsonResponse({}, 404),
      });
      expect(reasonOf(await lookup(board, postingLinks.ashby.link, missingBoard.fetcher))).toEqual({
        status: 'failed',
        reason: 'This Ashby board was not found. Check the link.',
      });
      const limited = recordedPostings({
        [postingLinks.lever.endpoint]: () => jsonResponse({}, 429),
      });
      expect(reasonOf(await lookup(board, postingLinks.lever.link, limited.fetcher)).reason).toBe(
        'The job board is rate limiting requests. Try again later.',
      );
      const other = recordedPostings({
        [postingLinks.lever.endpoint]: () =>
          jsonResponse({ id: 'a1b2c3d4-9999-4a5b-8c9d-0e1f2a3b4c5d', text: 'Other job' }),
      });
      expect(reasonOf(await lookup(board, postingLinks.lever.link, other.fetcher)).reason).toBe(
        'The Lever response did not include this posting.',
      );
      const html = recordedPostings({
        [postingLinks.lever.endpoint]: () =>
          new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
      });
      expect(reasonOf(await lookup(board, postingLinks.lever.link, html.fetcher)).reason).toBe(
        'The job board did not return JSON.',
      );
    });
  });

  it('enforces the size cap, request timeout and cancellation', async () => {
    await withBoard(async (board) => {
      const large = recordedPostings({
        [postingLinks.lever.endpoint]: () =>
          new Response('{}', {
            headers: { 'content-type': 'application/json', 'content-length': '999999999' },
          }),
      });
      expect(reasonOf(await lookup(board, postingLinks.lever.link, large.fetcher)).reason).toBe(
        'The job board response is too large.',
      );
      const stalled: FetchLike = () => new Promise(() => {});
      expect(
        reasonOf(await lookup(board, postingLinks.lever.link, stalled, { timeoutMs: 30 })).reason,
      ).toBe('The job board request timed out.');
      const controller = new AbortController();
      const pending = lookup(board, postingLinks.lever.link, stalled, {
        signal: controller.signal,
      });
      controller.abort();
      expect(reasonOf(await pending).reason).toBe('The lookup was cancelled.');
    });
  });

  it('waits for the provider spacing shared with scans', async () => {
    const limiter = new ProviderRateLimiter(80);
    const { fetcher } = recordedPostings();
    await withBoard(async (board) => {
      const start = Date.now();
      await limiter.schedule('lever', async () => {});
      found(await lookup(board, postingLinks.lever.link, fetcher, { limiter }));
      expect(Date.now() - start).toBeGreaterThanOrEqual(70);
    });
  });
});

describe('posting lookups over HTTP', () => {
  it('keeps lookups behind the local UI session and out of agent reach', async () => {
    const { daemon, cookie, request } = await setup(15531);
    const { calls, fetcher } = recordedPostings();
    daemon.service.jobSources.fetch = fetcher;
    const runId = 'lookup-boundary';
    daemon.service.board.record(
      'run',
      {
        id: runId,
        roleId: 'scout',
        cardId: null,
        runtime: 'demo',
        status: 'running',
        mode: 'chat',
        threadId: 'scout',
        message: 'Fictional run',
        startedAt: new Date().toISOString(),
        finishedAt: null,
      } satisfies Run,
      'scout',
      'Fixture',
    );
    daemon.service.controllers.set(runId, new AbortController());
    daemon.service.capabilities.set('lookup-token', { runId, roleId: 'scout', cardId: null });
    for (const headers of [
      {},
      { cookie },
      { 'x-pitchcrew-client': 'ui' },
      { authorization: 'Bearer lookup-token', 'x-pitchcrew-client': 'ui' },
      { cookie, 'x-pitchcrew-client': 'ui', origin: 'https://evil.example' },
    ] as Record<string, string>[]) {
      const response = await fetch(`${daemon.url}/api/jobs/lookup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ url: postingLinks.lever.link }),
      });
      expect(response.status).toBe(403);
    }
    for (const action of ['lookup_job', 'job_lookup', 'fetch_job_link'])
      await expect(
        daemon.service.agentCall('lookup-token', action, { url: postingLinks.lever.link }),
      ).rejects.toThrow('not allowed');
    expect(calls).toEqual([]);
    daemon.service.controllers.delete(runId);
    const extra = await request('/jobs/lookup', 'POST', {
      url: postingLinks.lever.link,
      endpoint: 'https://evil.example',
    });
    expect(extra.response.status).toBe(400);
    const ok = await request<JobLookupResult>('/jobs/lookup', 'POST', {
      url: postingLinks.lever.link,
    });
    expect(ok.response.status).toBe(200);
    expect(found(ok.result).prefill.title).toBe('Backend Engineer');
    const unknown = await request<JobLookupResult>('/jobs/lookup', 'POST', {
      url: 'https://careers.example.com/jobs/42',
    });
    expect(unknown.result.status).toBe('unrecognized');
    expect(daemon.service.board.list<Card>('card')).toEqual([]);
  });

  it('shows possible duplicates before the user saves', async () => {
    const { daemon, request } = await setup(15532);
    daemon.service.jobSources.fetch = recordedPostings().fetcher;
    const manual = await request<Card>('/cards', 'POST', {
      company: 'Northwind Labs',
      title: 'Frontend role',
      url: 'https://job-boards.greenhouse.io/northwindlabs/jobs/4010001001?utm_source=board#top',
    });
    await request<Card>('/cards', 'POST', { company: 'Northwind Labs', title: 'Other role' });
    const external = await request<Card>('/tracking/external', 'POST', {
      company: 'Contoso Robotics',
      title: 'Backend Engineer',
      url: '',
      submittedAt: '2026-09-01T00:00:00.000Z',
      jobIdentifier: leverJobId,
      note: 'Applied on the fictional company site.',
    });
    expect(external.response.status).toBe(201);
    const greenhouse = found(
      (
        await request<JobLookupResult>('/jobs/lookup', 'POST', {
          url: postingLinks.greenhouse.link,
        })
      ).result,
    );
    expect(greenhouse.duplicates).toEqual([
      { id: manual.result.id, company: 'Northwind Labs', title: 'Frontend role', state: 'lead' },
    ]);
    const lever = found(
      (await request<JobLookupResult>('/jobs/lookup', 'POST', { url: postingLinks.lever.link }))
        .result,
    );
    expect(lever.duplicates.map((card) => [card.id, card.state])).toEqual([
      [external.result.id, 'submitted'],
    ]);
    const ashby = found(
      (await request<JobLookupResult>('/jobs/lookup', 'POST', { url: postingLinks.ashby.link }))
        .result,
    );
    expect(ashby.duplicates).toEqual([]);
  });

  it('saves a fetched job with link provenance so discovery never adds it again', async () => {
    const { daemon, request } = await setup(15533);
    const boards = recordedPostings();
    daemon.service.jobSources.fetch = boards.fetcher;
    const { prefill } = found(
      (
        await request<JobLookupResult>('/jobs/lookup', 'POST', {
          url: postingLinks.greenhouse.link,
        })
      ).result,
    );
    const { jobIdentifier: _identifier, ...fields } = prefill;
    const saved = await request<Card>('/cards', 'POST', { ...fields, tags: ['fetched'] });
    expect(saved.response.status).toBe(201);
    expect(saved.result).toMatchObject({
      company: 'Northwind Labs',
      state: 'lead',
      tags: ['fetched'],
      tracking: { origin: 'pitchcrew', jobIdentifier: '4010001001', gmailThreads: [] },
      discovery: {
        provider: 'greenhouse',
        sourceId: 'link',
        sourceName: 'northwindlabs',
        slug: 'northwindlabs',
        jobId: '4010001001',
        postedAt: '2026-09-20T13:00:00.000Z',
      },
    });
    expect(Date.parse(saved.result.discovery!.firstSeenAt)).toBeGreaterThan(0);
    const [event] = daemon.service.board.history(saved.result.id);
    expect(event.version).toBe(currentEventVersion);
    expect(event.version).toBe(11);
    expect(decodeEvent(JSON.stringify(event)).data).toMatchObject({
      discovery: { sourceId: 'link' },
    });
    // Looking the same link up again now reports the saved card.
    const again = found(
      (
        await request<JobLookupResult>('/jobs/lookup', 'POST', {
          url: postingLinks.greenhouse.link,
        })
      ).result,
    );
    expect(again.duplicates.map((card) => card.id)).toEqual([saved.result.id]);
    // A later scan of the same board, under a different company name, skips the saved job.
    await request<JobSource>('/job-sources', 'POST', {
      ...fixtureSources.greenhouse,
      name: 'Northwind',
    });
    const summary = (await request<JobScanSummary>('/job-sources/scan', 'POST', {})).result;
    expect(summary.duplicate).toBe(1);
    expect(summary.newLeads.map((lead) => lead.title)).not.toContain('Senior Frontend Engineer');
    const cards = daemon.service.board.list<Card>('card');
    expect(cards.filter((card) => card.tracking?.jobIdentifier === '4010001001')).toHaveLength(1);
    // Replay keeps the provenance.
    daemon.service.board.rebuild();
    expect(daemon.service.board.get<Card>('card', saved.result.id).discovery?.sourceId).toBe(
      'link',
    );
  });

  it('rejects malformed provenance and keeps manual entry unchanged', async () => {
    const { request } = await setup(15534);
    for (const provenance of [
      { provider: 'workday', board: 'acme', jobId: '1' },
      { provider: 'greenhouse', board: '../admin', jobId: '1' },
      { provider: 'lever', board: 'acme', jobId: '1' },
      { provider: 'greenhouse', board: 'acme', jobId: '1', sourceId: 'x' },
    ]) {
      const response = await request('/cards', 'POST', {
        company: 'Example Works',
        title: 'Analyst',
        provenance,
      });
      expect(response.response.status, JSON.stringify(provenance)).toBe(400);
    }
    const manual = await request<Card>('/cards', 'POST', {
      company: 'Example Works',
      title: 'Analyst',
      url: 'https://careers.example.com/jobs/42',
      description: 'Pasted by hand.',
    });
    expect(manual.response.status).toBe(201);
    expect(manual.result.discovery).toBeUndefined();
    expect(manual.result.tracking).toBeUndefined();
  });
});

const savedComeet = (name = 'Wingtip') =>
  [{ ...moreFixtureSources.comeet, name, id: 'saved-comeet' }] as unknown as JobSource[];

describe('Ashby, Comeet and Workable links', () => {
  it('reads an Ashby board whose name has a space, encoded as scans encode it', async () => {
    const { calls, fetcher } = recordedPostings();
    const result = found(
      await withBoard((board) => lookup(board, postingLinks.ashbySpaced.link, fetcher)),
    );
    expect(calls.map((call) => call.url)).toEqual([postingLinks.ashbySpaced.endpoint]);
    expect(result.prefill).toMatchObject({
      company: 'Northwind Scientific',
      title: 'Product Designer',
      provenance: { provider: 'ashby', board: 'Northwind Scientific', jobId: ashbyJobId },
    });
  });

  it('asks for a saved Comeet source before fetching a hosted link', async () => {
    const { calls, fetcher } = recordedPostings();
    const result = await withBoard((board) => lookup(board, postingLinks.comeet.link, fetcher));
    expect(result).toEqual({ status: 'failed', reason: comeetSourceNeeded });
    expect(calls).toEqual([]);
  });

  it('reads a Comeet hosted link with the saved source token and never returns it', async () => {
    const { calls, fetcher } = recordedPostings();
    const result = found(
      await withBoard((board) =>
        lookup(board, postingLinks.comeet.link, fetcher, { sources: async () => savedComeet() }),
      ),
    );
    expect(calls.map((call) => call.url)).toEqual([postingLinks.comeet.endpoint]);
    expect(result.prefill).toMatchObject({
      company: 'Wingtip',
      title: 'Senior Backend Engineer',
      url: 'https://www.comeet.com/jobs/wingtip-analytics/A1.B2C/senior-backend-engineer/A1.00D',
      jobIdentifier: 'A1.00D',
      provenance: { provider: 'comeet', board: 'A1.B2C', jobId: 'A1.00D' },
    });
    expect(JSON.stringify(result)).not.toContain(comeetFixtureToken);
  });

  it('uses an embed link token for one lookup and keeps it out of results and errors', async () => {
    const { calls, fetcher } = recordedPostings();
    await withBoard(async (board) => {
      const result = found(await lookup(board, postingLinks.comeetEmbed.link, fetcher));
      expect(calls.map((call) => call.url)).toEqual([postingLinks.comeetEmbed.endpoint]);
      expect(result.prefill.company).toBe('Wingtip Analytics');
      expect(JSON.stringify(result)).not.toContain(comeetFixtureToken);
      const rejected = recordedPostings({
        [postingLinks.comeetEmbed.endpoint]: () => jsonResponse({}, 401),
      });
      const denied = reasonOf(await lookup(board, postingLinks.comeetEmbed.link, rejected.fetcher));
      expect(denied.reason).toContain('Comeet did not accept the company UID and token');
      // A network error that echoes the request URL is redacted too.
      const echo: FetchLike = async (url) => {
        throw new Error(`connection refused for ${url}`);
      };
      const failed = reasonOf(await lookup(board, postingLinks.comeetEmbed.link, echo));
      expect(failed.reason).toContain('[token]');
      expect(JSON.stringify([denied, failed])).not.toContain(comeetFixtureToken);
      // The posting must be on the board; an unknown position is reported plainly.
      const missing = postingLinks.comeetEmbed.link.replace('A1.00D', 'A1.0FF');
      expect(reasonOf(await lookup(board, missing, fetcher)).reason).toBe(
        'This posting is not on the public Comeet board. It may be closed.',
      );
    });
  });

  it('looks up Comeet office-specific links using the base job identifier', async () => {
    for (const url of [
      postingLinks.comeet.link.replace('A1.00D', 'A1.00D-B3.C4D'),
      postingLinks.comeetEmbed.link.replace('A1.00D', 'A1.00D-B3.C4D'),
    ]) {
      const result = found(
        await withBoard((board) =>
          lookup(board, url, recordedPostings().fetcher, { sources: async () => savedComeet() }),
        ),
      );
      expect(result.prefill.jobIdentifier).toBe('A1.00D');
      expect(result.prefill.provenance.jobId).toBe('A1.00D');
      expect(result.prefill.url).not.toContain('A1.00D-B3.C4D');
    }
  });

  it('reads a Workable link by picking the shortcode from the account', async () => {
    const { calls, fetcher } = recordedPostings();
    const result = found(
      await withBoard((board) => lookup(board, postingLinks.workable.link, fetcher)),
    );
    expect(calls.map((call) => call.url)).toEqual([postingLinks.workable.endpoint]);
    expect(result.prefill).toMatchObject({
      company: 'Litware Studio',
      title: 'Frontend Developer',
      jobIdentifier: '3F2A1B0C9D',
      provenance: { provider: 'workable', board: 'litware', jobId: '3F2A1B0C9D' },
    });
    const missing = recordedPostings({
      [postingLinks.workable.endpoint]: () => jsonResponse({}, 404),
    });
    expect(
      reasonOf(
        await withBoard((board) => lookup(board, postingLinks.workable.link, missing.fetcher)),
      ).reason,
    ).toBe('Workable account not found. Check the account name.');
  });

  it('keeps the Comeet token out of lookups, saved cards and events over HTTP', async () => {
    const { daemon, request } = await setup(15535);
    const boards = recordedPostings();
    daemon.service.jobSources.fetch = boards.fetcher;
    const before = await request<JobLookupResult>('/jobs/lookup', 'POST', {
      url: postingLinks.comeet.link,
    });
    expect(before.result).toEqual({ status: 'failed', reason: comeetSourceNeeded });
    await request<JobSource>('/job-sources', 'POST', {
      ...moreFixtureSources.comeet,
      name: 'Wingtip',
    });
    const hosted = await request<JobLookupResult>('/jobs/lookup', 'POST', {
      url: postingLinks.comeet.link,
    });
    expect(found(hosted.result).prefill.title).toBe('Senior Backend Engineer');
    expect(JSON.stringify(hosted.result)).not.toContain(comeetFixtureToken);
    const lookup = await request<JobLookupResult>('/jobs/lookup', 'POST', {
      url: postingLinks.comeetEmbed.link,
    });
    const text = JSON.stringify(lookup.result);
    expect(text).not.toContain(comeetFixtureToken);
    const { prefill } = found(lookup.result);
    expect(prefill.company).toBe('Wingtip');
    const { jobIdentifier: _id, ...fields } = prefill;
    const saved = await request<Card>('/cards', 'POST', fields);
    expect(saved.response.status).toBe(201);
    expect(saved.result.discovery).toMatchObject({
      provider: 'comeet',
      slug: 'A1.B2C',
      jobId: 'A1.00D',
    });
    const sneaky = await request('/cards', 'POST', {
      ...fields,
      provenance: { ...prefill.provenance, token: comeetFixtureToken },
    });
    expect(sneaky.response.status).toBe(400);
    const history = daemon.service.board.history(saved.result.id);
    expect(JSON.stringify(history)).not.toContain(comeetFixtureToken);
    expect(JSON.stringify(daemon.service.board.list('card'))).not.toContain(comeetFixtureToken);
    // A later scan of the saved Comeet source skips the job saved from the link.
    const summary = (await request<JobScanSummary>('/job-sources/scan', 'POST', {})).result;
    expect(summary.newLeads.map((lead) => lead.title)).not.toContain('Senior Backend Engineer');
    expect(summary.duplicate).toBeGreaterThanOrEqual(1);
  });
});
