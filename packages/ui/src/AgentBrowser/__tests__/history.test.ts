import { expect, test } from 'vitest';
import { historyAddress, readBrowserHistory, rememberBrowserPage } from '../history.ts';

test('retains a bounded recency list and updates the title when a person revisits a page', () => {
  let entries = [] as ReturnType<typeof readBrowserHistory>;
  for (let index = 0; index < 60; index++)
    entries = rememberBrowserPage(
      entries,
      { url: `https://example.com/jobs/${index}`, title: `Job ${index}` },
      index,
    );
  expect(entries).toHaveLength(50);
  expect(entries[0].url).toBe('https://example.com/jobs/59');
  entries = rememberBrowserPage(
    entries,
    { url: 'https://example.com/jobs/12', title: 'Updated role' },
    100,
  );
  expect(entries).toHaveLength(50);
  expect(entries[0]).toEqual({
    url: 'https://example.com/jobs/12',
    title: 'Updated role',
    visitedAt: 100,
  });
  expect(readBrowserHistory(JSON.stringify(entries))).toEqual(entries);
});

test('does not store blank pages, embedded credentials or transient authentication URLs', () => {
  for (const value of [
    'about:blank',
    'file:///tmp/candidate.txt',
    'https://candidate:password@example.com/',
    'https://example.com/callback?code=temporary-code',
    'https://example.com/callback?access_token=private-token',
    'https://example.com/callback?id_token=private-token',
    'https://example.com/callback?token=private-token',
    'https://example.com/callback#access_token=private-token',
    `https://example.com/${'x'.repeat(2048)}`,
  ])
    expect(historyAddress(value)).toBeNull();
  expect(historyAddress('https://example.com/jobs?team=design#/open-roles')).toBe(
    'https://example.com/jobs?team=design#/open-roles',
  );
});

test('ignores corrupt persisted history and limits recently closed tabs separately', () => {
  expect(readBrowserHistory('{broken')).toEqual([]);
  expect(readBrowserHistory(JSON.stringify({ url: 'https://example.com' }))).toEqual([]);
  expect(
    readBrowserHistory(
      JSON.stringify([
        { url: 'https://example.com/', title: 'Valid', visitedAt: 1 },
        { url: 'https://example.com/', title: 7, visitedAt: 1 },
        { url: 'javascript:alert(1)', title: 'Invalid', visitedAt: 1 },
        { url: 'https://example.com/', title: 'Invalid', visitedAt: 'yesterday' },
      ]),
    ),
  ).toEqual([{ url: 'https://example.com/', title: 'Valid', visitedAt: 1 }]);
  let closed = [] as ReturnType<typeof readBrowserHistory>;
  for (let index = 0; index < 25; index++)
    closed = rememberBrowserPage(
      closed,
      { url: `https://example.com/closed/${index}`, title: `Closed ${index}` },
      index,
      20,
    );
  expect(closed).toHaveLength(20);
  expect(closed[0].url).toBe('https://example.com/closed/24');
});
