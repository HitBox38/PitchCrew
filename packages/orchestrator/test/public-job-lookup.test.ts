import { Board } from '@pitchcrew/board';
import type { JobLookupResult } from '@pitchcrew/core';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { ProviderRateLimiter } from '../src/job-sources/fetch.ts';
import { lookupPublicJobLink } from '../src/job-sources/lookup-public.ts';
import { structuredJobDetails } from '../src/job-sources/page-details.ts';
import { cleanup, setup } from './helpers/daemon.ts';

afterEach(cleanup);
const pageUrl = 'https://careers.example.com/jobs/frontend-engineer';
const fixture = (name: string) =>
  readFile(new URL(`./fixtures/job-pages/${name}.html`, import.meta.url), 'utf8');
const found = (result: JobLookupResult) => {
  if (result.status !== 'found') throw new Error(result.reason);
  return result;
};
async function createContext() {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-test-public-lookup-'));
  const board = new Board(join(directory, 'board.db'));
  const readPage = vi.fn().mockResolvedValue({ url: pageUrl, html: await fixture('structured') });
  const fetch = vi.fn().mockRejectedValue(new Error('Unexpected API request'));
  const dependencies = {
    board,
    readPage,
    fetch,
    limiter: new ProviderRateLimiter(0),
    sources: async () => [],
    signal: new AbortController().signal,
  };
  return {
    ...dependencies,
    dependencies,
    close: async () => {
      board.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

it.each(['structured', 'microdata'])(
  'prefills a %s public page without saving or inventing provider provenance',
  async (name) => {
    const context = await createContext();
    try {
      context.readPage.mockResolvedValue({ url: pageUrl, html: await fixture(name) });
      const result = found(await lookupPublicJobLink({ url: pageUrl }, context.dependencies));
      expect(result.prefill).toMatchObject({
        company: 'Northwind',
        title: 'Frontend Engineer',
        location: 'Haifa, Israel',
        url: pageUrl,
        jobIdentifier: '',
      });
      expect(result.prefill.description).toContain('Build accessible interfaces.');
      expect(result.prefill.description).not.toContain('ignore');
      expect(result.prefill.provenance).toBeUndefined();
      expect(result.prefill.sourceHtml).toBeUndefined();
      expect(context.board.list('card')).toHaveLength(0);
      expect(context.fetch).not.toHaveBeenCalled();
    } finally {
      await context.close();
    }
  },
);

it('reads SmartRecruiters through its fixed API and ignores response URLs', async () => {
  const context = await createContext();
  try {
    context.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: '744000100000001',
          active: true,
          company: { name: 'Northwind', identifier: 'Northwind' },
          name: 'Engineer',
          location: { city: 'Haifa' },
          postingUrl: 'http://127.0.0.1/private',
          ref: 'http://127.0.0.1/private',
          jobAd: {
            sections: {
              jobDescription: { text: '<p>Build interfaces.</p>' },
              qualifications: { text: 'TypeScript.' },
            },
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );
    const result = found(
      await lookupPublicJobLink(
        { url: 'https://jobs.smartrecruiters.com/Northwind/744000100000001-engineer' },
        context.dependencies,
      ),
    );
    expect(result.prefill).toMatchObject({
      company: 'Northwind',
      jobIdentifier: '744000100000001',
      description: 'Build interfaces.\n\nTypeScript.',
    });
    expect(context.fetch).toHaveBeenCalledWith(
      'https://api.smartrecruiters.com/v1/companies/Northwind/postings/744000100000001',
      expect.objectContaining({ credentials: 'omit', redirect: 'error' }),
    );
    expect(context.readPage).not.toHaveBeenCalled();
  } finally {
    await context.close();
  }
});

it('returns duplicate warnings across pasted and resolved URLs, including closed cards', async () => {
  const context = await createContext();
  try {
    const card = context.board.createCard({
      company: 'Northwind',
      title: 'Frontend Engineer',
      url: pageUrl,
      location: '',
      salary: '',
      description: '',
      tags: [],
    });
    context.board.record('card', { ...card, state: 'withdrawn' }, 'user', 'Fixture closed card');
    const result = found(await lookupPublicJobLink({ url: pageUrl }, context.dependencies));
    expect(result.duplicates).toMatchObject([{ id: card.id, state: 'withdrawn' }]);
  } finally {
    await context.close();
  }
});

it.each([
  { id: '744000100000001', active: false },
  { id: '744000100000002', active: true },
])('offers Scout for an inactive or mismatched SmartRecruiters response: %j', async (body) => {
  const context = await createContext();
  try {
    context.fetch.mockResolvedValue(
      new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }),
    );
    const result = await lookupPublicJobLink(
      { url: 'https://jobs.smartrecruiters.com/Northwind/744000100000001-engineer' },
      context.dependencies,
    );
    expect(result).toEqual({
      status: 'unrecognized',
      reason: expect.stringContaining('Ask Scout'),
    });
    expect(context.board.list('card')).toHaveLength(0);
  } finally {
    await context.close();
  }
});

it('uses the fixed provider lookup after a public-page redirect', async () => {
  const context = await createContext();
  try {
    const providerUrl = 'https://job-boards.greenhouse.io/northwind/jobs/123';
    context.readPage.mockResolvedValue({ url: providerUrl, html: '' });
    context.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 123,
          company_name: 'Northwind',
          title: 'Frontend Engineer',
          content: '<p>Build interfaces.</p>',
          absolute_url: providerUrl,
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );
    const result = found(await lookupPublicJobLink({ url: pageUrl }, context.dependencies));
    expect(result.prefill.provenance).toMatchObject({
      provider: 'greenhouse',
      board: 'northwind',
      jobId: '123',
    });
    expect(context.fetch).toHaveBeenCalledWith(
      'https://boards-api.greenhouse.io/v1/boards/northwind/jobs/123?content=true',
      expect.anything(),
    );
  } finally {
    await context.close();
  }
});

it.each(['<h1>Careers</h1>', '<script type="application/ld+json">{bad json}</script>'])(
  'offers Scout for incomplete metadata without returning raw page content',
  async (html) => {
    const context = await createContext();
    try {
      context.readPage.mockResolvedValue({ url: pageUrl, html });
      expect(await lookupPublicJobLink({ url: pageUrl }, context.dependencies)).toEqual({
        status: 'unrecognized',
        reason: expect.stringContaining('Ask Scout'),
      });
    } finally {
      await context.close();
    }
  },
);

it('does not fetch LinkedIn, home pages or malformed provider links', async () => {
  const context = await createContext();
  try {
    for (const url of [
      'https://www.linkedin.com/jobs/view/123',
      'https://example.com/',
      'https://jobs.lever.co/example/not-a-job',
    ])
      expect((await lookupPublicJobLink({ url }, context.dependencies)).status).toBe(
        'unrecognized',
      );
    expect(context.readPage).not.toHaveBeenCalled();
    expect(context.fetch).not.toHaveBeenCalled();
  } finally {
    await context.close();
  }
});

it('honors cancellation after a page returns', async () => {
  const context = await createContext();
  try {
    const controller = new AbortController();
    context.readPage.mockImplementation(async () => {
      controller.abort();
      return { url: pageUrl, html: await fixture('structured') };
    });
    expect(
      await lookupPublicJobLink(
        { url: pageUrl },
        { ...context.dependencies, signal: controller.signal },
      ),
    ).toEqual({ status: 'failed', reason: 'The lookup was cancelled.' });
    expect(context.board.list('card')).toHaveLength(0);
  } finally {
    await context.close();
  }
});

it('reads scoped microdata and rejects pages with multiple postings', async () => {
  const html = await fixture('microdata');
  const result = structuredJobDetails(html);
  expect(result?.description).toContain('Collaborate with designers.');
  expect(result?.description).toContain('TypeScript experience.');
  expect(result?.title).toBe('Frontend Engineer');
  expect(structuredJobDetails(html + html)).toBeNull();
  expect(structuredJobDetails((await fixture('structured')) + html + html)).toBeNull();
  expect(
    structuredJobDetails(
      (await fixture('structured')) + html.replace('Frontend Engineer', 'A different role'),
    ),
  ).toBeNull();
});

it('keeps public lookups session-protected and saves reviewed fields without discovery metadata', async () => {
  const { daemon, request } = await setup(15721);
  daemon.service.jobSources.readPage = async () => ({
    url: pageUrl,
    html: await fixture('structured'),
  });
  const anonymous = await fetch(`${daemon.url}/api/jobs/lookup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: pageUrl }),
  });
  expect(anonymous.status).toBe(403);
  const lookup = await request<JobLookupResult>('/jobs/lookup', 'POST', { url: pageUrl });
  const prefill = found(lookup.result).prefill;
  const saved = await request<{ discovery?: unknown; company: string }>('/cards', 'POST', prefill);
  expect(saved.response.status).toBe(201);
  expect(saved.result.company).toBe('Northwind');
  expect(saved.result.discovery).toBeUndefined();
});
