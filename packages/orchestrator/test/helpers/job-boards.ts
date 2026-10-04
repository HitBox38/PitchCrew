import { readFileSync } from 'node:fs';
import type { FetchLike } from '../../src/job-sources/fetch.ts';

export const boardFixture = (name: 'greenhouse' | 'ashby' | 'lever'): unknown =>
  JSON.parse(
    readFileSync(new URL(`../fixtures/job-boards/${name}.json`, import.meta.url), 'utf8'),
  ) as unknown;
export const fixtureUrls = {
  greenhouse: 'https://boards-api.greenhouse.io/v1/boards/northwindlabs/jobs?content=true',
  ashby: 'https://api.ashbyhq.com/posting-api/job-board/fabrikam?includeCompensation=true',
  lever: 'https://api.lever.co/v0/postings/contoso-robotics?mode=json',
} as const;
export const fixtureSources = {
  greenhouse: { provider: 'greenhouse', slug: 'northwindlabs', name: 'Northwind Labs' },
  ashby: { provider: 'ashby', slug: 'fabrikam', name: 'Fabrikam' },
  lever: { provider: 'lever', slug: 'contoso-robotics', name: 'Contoso Robotics' },
} as const;

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

/** Serve recorded fixtures for the fixed endpoints; any other URL is a test failure. */
export function recordedBoards(overrides: Record<string, () => Response> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher: FetchLike = async (url, init) => {
    calls.push({ url, init });
    if (overrides[url]) return overrides[url]();
    const entry = Object.entries(fixtureUrls).find(([, value]) => value === url);
    if (!entry) return jsonResponse({ error: 'Not found' }, 404);
    return jsonResponse(boardFixture(entry[0] as keyof typeof fixtureUrls));
  };
  return { calls, fetcher };
}
