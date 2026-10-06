import { readFileSync } from 'node:fs';
import type { FetchLike } from '../../src/job-sources/fetch.ts';
import {
  boardFixture,
  comeetFixtureToken,
  fixtureUrls,
  jsonResponse,
  moreFixtureUrls,
} from './job-boards.ts';

export const leverJobId = 'a1b2c3d4-0001-4a5b-8c9d-0e1f2a3b4c5d';
export const ashbyJobId = '6f1c2b3a-1111-4c3d-9e8f-0a1b2c3d4e5f';
/** Fictional posting links and the one endpoint each lookup may call. */
export const postingLinks = {
  greenhouse: {
    link: 'https://boards.greenhouse.io/northwindlabs/jobs/4010001001?gh_src=fictional',
    endpoint:
      'https://boards-api.greenhouse.io/v1/boards/northwindlabs/jobs/4010001001?content=true',
  },
  ashby: {
    link: `https://jobs.ashbyhq.com/fabrikam/${ashbyJobId}/application`,
    endpoint: fixtureUrls.ashby,
  },
  lever: {
    link: `https://jobs.lever.co/contoso-robotics/${leverJobId}/apply`,
    endpoint: `https://api.lever.co/v0/postings/contoso-robotics/${leverJobId}?mode=json`,
  },
  ashbySpaced: {
    link: `https://jobs.ashbyhq.com/Northwind%20Scientific/${ashbyJobId}/application`,
    endpoint:
      'https://api.ashbyhq.com/posting-api/job-board/Northwind%20Scientific?includeCompensation=true',
  },
  comeet: {
    link: 'https://www.comeet.com/jobs/wingtip-analytics/A1.B2C/senior-backend-engineer/A1.00D',
    endpoint: moreFixtureUrls.comeet,
  },
  comeetEmbed: {
    link: `https://www.comeet.co/jobs/A1.B2C/A1.00D/apply?token=${comeetFixtureToken}&embedded=true`,
    endpoint: moreFixtureUrls.comeet,
  },
  workable: {
    link: 'https://apply.workable.com/litware/j/3F2A1B0C9D/',
    endpoint: moreFixtureUrls.workable,
  },
} as const;
const postingFixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(new URL(`../fixtures/job-boards/${name}.json`, import.meta.url), 'utf8'),
  ) as unknown;

/** Serve recorded single postings and boards; any other URL answers 404 and is recorded. */
export function recordedPostings(overrides: Record<string, () => Response> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher: FetchLike = async (url, init) => {
    calls.push({ url, init });
    if (overrides[url]) return overrides[url]();
    if (url === postingLinks.greenhouse.endpoint)
      return jsonResponse(postingFixture('greenhouse-job'));
    if (url === postingLinks.lever.endpoint) return jsonResponse(postingFixture('lever-posting'));
    if (url === postingLinks.ashbySpaced.endpoint) return jsonResponse(boardFixture('ashby'));
    const board = Object.entries({ ...fixtureUrls, ...moreFixtureUrls }).find(
      ([, value]) => value === url,
    );
    if (board)
      return jsonResponse(
        boardFixture(board[0] as keyof typeof fixtureUrls | 'comeet' | 'workable'),
      );
    return jsonResponse({ ok: false, error: 'Document not found' }, 404);
  };
  return { calls, fetcher };
}
