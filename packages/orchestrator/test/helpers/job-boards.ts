import { readFileSync } from 'node:fs';
import type { FetchLike } from '../../src/job-sources/fetch.ts';

export const boardFixture = (
  name: 'greenhouse' | 'ashby' | 'lever' | 'comeet' | 'workable',
): unknown =>
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
/** A fictional, public-style Comeet careers token. */
export const comeetFixtureToken = 'FictionalToken0123456789';
/** Comeet and Workable fixtures, kept apart so the original three-provider counts stay stable. */
export const moreFixtureUrls = {
  comeet: `https://www.comeet.co/careers-api/2.0/company/A1.B2C/positions?details=true&token=${comeetFixtureToken}`,
  workable: 'https://apply.workable.com/api/v1/widget/accounts/litware?details=true',
} as const;
export const moreFixtureSources = {
  comeet: {
    provider: 'comeet',
    slug: 'A1.B2C',
    token: comeetFixtureToken,
    name: 'Wingtip Analytics',
  },
  workable: { provider: 'workable', slug: 'litware', name: 'Litware Studio' },
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
    const entry = Object.entries({ ...fixtureUrls, ...moreFixtureUrls }).find(
      ([, value]) => value === url,
    );
    if (!entry) return jsonResponse({ error: 'Not found' }, 404);
    return jsonResponse(
      boardFixture(entry[0] as keyof typeof fixtureUrls | keyof typeof moreFixtureUrls),
    );
  };
  return { calls, fetcher };
}
