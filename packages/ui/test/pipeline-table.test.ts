import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { Snapshot } from '@pitchcrew/core';
import { cleanup, setup } from './helpers/daemon.ts';
import {
  giveBrief,
  seedPipelineTable,
  type PipelineTableFixture,
} from './fixtures/pipeline-table.ts';

// Pipeline's Table mode on its own cast (one busy slot, nineteen leads): Home's Not scored link,
// the Queue cell, the Title's width at 1280, keys scoped to the table, focus after job details,
// sticky bars that never hide the focused row, the Board | Table choice in the URL and on the
// device, bulk Evaluate fit with every outcome (a lost answer included), and the phone list.
// Checks that leave the board as they found it run first; Evaluate fit queues fits, so it runs last.
let host: Awaited<ReturnType<typeof setup>>;
let fixture: PipelineTableFixture;
let browser: Browser;
let page: Page;
const problems: string[] = [];

/** Page errors and Base UI warnings fail the file, from every page it opens. */
const watch = (opened: Page) => {
  opened.setDefaultTimeout(15000);
  opened.on('pageerror', (error) => problems.push(error.message));
  opened.on('console', (message) => {
    if (message.text().includes('Base UI')) problems.push(message.text());
  });
  return opened;
};

beforeAll(async () => {
  host = await setup();
  fixture = await seedPipelineTable(host.daemon.service);
  browser = await chromium.launch({ headless: true });
  page = watch(
    await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }),
  );
  // Load Pipeline's page module once, then start on Home, whose "{k} not scored" link opens the
  // table in test 1.
  await page.goto(`${host.daemon.url}/pipeline?mode=table&view=not-scored`);
  await page.locator('table.pipeline-table').waitFor({ timeout: 30000 });
  await page.goto(`${host.daemon.url}/`);
  await page.getByRole('link', { name: '16 not scored', exact: true }).waitFor({ timeout: 30000 });
}, 120000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
}, 60000);

const rowButton = (id: string) => page.locator(`[data-table-open="${id}"]`);
const row = (id: string) => rowButton(id).locator('xpath=ancestor::tr[1]');
const focusedRow = () =>
  page.evaluate(() => document.activeElement?.getAttribute('data-table-open') ?? null);
const snapshot = async () => (await host.request<Snapshot>('/snapshot?view=workspace')).result;

test('opens the Not scored view from Home’s link, with each job’s Queue story', async () => {
  await page.getByRole('link', { name: '16 not scored', exact: true }).click();
  await page.locator('table.pipeline-table').waitFor({ timeout: 30000 });
  expect(new URL(page.url()).search).toBe('?mode=table&view=not-scored');
  await page
    .getByRole('button', { name: /^Not scored/ })
    .first()
    .waitFor();
  expect(
    await page
      .getByRole('button', { name: /^Not scored/ })
      .first()
      .getAttribute('aria-pressed'),
  ).toBe('true');
  expect(
    await page.getByRole('button', { name: 'Table', exact: true }).getAttribute('aria-pressed'),
  ).toBe('true');
  expect(await page.locator('tbody [data-table-open]').count()).toBe(16);
  await expect
    .poll(() => page.locator('.pipeline-table-pager output').textContent())
    .toBe('1–16 of 16 jobs');
  // Corvid's failed fit is the job's ask: rose words and one control that opens it on Home.
  const corvid = row(fixture.corvid);
  expect(await corvid.locator('.queue-cell-line').getAttribute('data-tone')).toBe('rose');
  expect(await corvid.locator('.queue-cell-text').textContent()).toBe('Scout · failed');
  // Its name starts with the word it shows, so "click Failure" reaches it.
  expect(await corvid.locator('.queue-cell-action').textContent()).toBe('Failure');
  const failure = corvid.getByRole('link', {
    name: 'Failure: open Corvid’s failed request on Home',
  });
  expect(decodeURIComponent((await failure.getAttribute('href')) ?? '')).toBe(
    `/?item=failure:job:${fixture.corvid}`,
  );
  // Fits already waiting for the one busy slot show their places in line.
  expect(await row(fixture.northwind).locator('.queue-cell').textContent()).toContain(
    'Scout · waiting for a slot1st',
  );
  expect(await row(fixture.kestrel).locator('.queue-cell-meta').textContent()).toBe('2nd');
  expect(await row(fixture.bare[0]!).locator('.queue-cell-next').textContent()).toBe(
    'Next: you prepare the job brief',
  );
});

test('keeps the Title readable at 1280×800 and Halcyon’s run plum in All open', async () => {
  const title = () =>
    page
      .locator('thead th[data-col="title"]')
      .evaluate((cell) => Math.round(cell.getBoundingClientRect().width));
  const width = await title();
  expect(width).toBeGreaterThanOrEqual(160);
  // Wider windows give the other columns room only where the Title keeps its width.
  for (const wider of [1366, 1440]) {
    await page.setViewportSize({ width: wider, height: 800 });
    await expect.poll(title).toBeGreaterThanOrEqual(width);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(title).toBe(width);
  await page
    .getByRole('button', { name: /^All open/ })
    .first()
    .click();
  await expect.poll(() => page.url()).not.toContain('view=');
  const halcyon = row(fixture.halcyon);
  expect(await halcyon.locator('.queue-cell-line').getAttribute('data-tone')).toBe('plum');
  expect(await halcyon.locator('.queue-cell-text').textContent()).toBe(
    'Reviewer · Reviewing the packet',
  );
  await halcyon.getByRole('link', { name: 'View Reviewer’s run on Halcyon' }).waitFor();
  expect(await page.locator('.pipeline-table-group th').allTextContents()).toEqual([
    'Needs you',
    'Working',
    'Waiting for a slot',
    'Nothing queued',
  ]);
  await page
    .getByRole('button', { name: /^Not scored/ })
    .first()
    .click();
  await expect.poll(() => page.url()).toContain('view=not-scored');
});

test('moves, selects and searches with keys only while focus is in the table', async () => {
  const first = await page
    .locator('tbody [data-table-open]')
    .first()
    .getAttribute('data-table-open');
  const second = await page
    .locator('tbody [data-table-open]')
    .nth(1)
    .getAttribute('data-table-open');
  await rowButton(first!).focus();
  await page.keyboard.press('j');
  expect(await focusedRow()).toBe(second);
  await page.keyboard.press('ArrowUp');
  expect(await focusedRow()).toBe(first);
  await page.keyboard.press('x');
  await expect.poll(() => row(first!).getAttribute('data-checked')).toBe('');
  await page.locator('.selection-bar').getByText('1 selected').waitFor();
  await page.keyboard.press('Escape');
  await expect.poll(() => page.locator('.selection-bar').count()).toBe(0);
  await page.keyboard.press('/');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe(
    'Search jobs',
  );
  // Outside the table the same keys do nothing to it.
  const outside = page.getByRole('link', { name: /^Pipeline/ }).first();
  await outside.focus();
  await page.keyboard.press('j');
  await page.keyboard.press('x');
  await page.keyboard.press('/');
  expect(await focusedRow()).toBeNull();
  expect(await page.locator('.selection-bar').count()).toBe(0);
  expect(await outside.evaluate((link) => link === document.activeElement)).toBe(true);
}, 30000);

test('opens job details with Enter and hands focus back to the row', async () => {
  await rowButton(fixture.northwind).focus();
  await page.keyboard.press('Enter');
  const details = page.getByRole('dialog').filter({ hasText: 'Northwind' });
  await details.waitFor();
  await page.keyboard.press('Escape');
  await details.waitFor({ state: 'detached' });
  await expect.poll(focusedRow).toBe(fixture.northwind);
});

test('never hides the focused row under the sticky header or the selection bar', async () => {
  const buttons = page.locator('tbody [data-table-open]');
  const count = await buttons.count();
  await buttons.first().focus();
  // Walk to the tray's foot with nothing selected, then select there: the bar docks under the
  // tray, which shrinks by the bar's height, and the row just selected stays in view.
  for (let step = 1; step < count; step++) await page.keyboard.press('j');
  await page.keyboard.press('x');
  await page.locator('.selection-bar').waitFor();
  // The row stays inside the tray's own scrolled edges: under the sticky header and above the
  // tray's foot, where the selection bar docks without covering it. (Polled: the tray keeps the
  // row in view when it resizes, before the next paint but after the bar is in the page.)
  const edges = () =>
    page.evaluate(() => {
      const focused = document.activeElement?.closest('tr')?.getBoundingClientRect();
      // A header cell, which sticks to the tray's top (the thead's own box scrolls away).
      const head = document.querySelector('.pipeline-table thead th')?.getBoundingClientRect();
      const tray = document.querySelector('.pipeline-table-tray')?.getBoundingClientRect();
      const bar = document.querySelector('.selection-bar')?.getBoundingClientRect();
      return focused && head && tray && bar
        ? {
            top: focused.top,
            bottom: focused.bottom,
            head: head.bottom,
            foot: tray.bottom,
            bar: bar.top,
          }
        : null;
    });
  const clear = () =>
    expect
      .poll(edges)
      .toSatisfy(
        (box) =>
          !!box &&
          box.top >= box.head - 0.5 &&
          box.bottom <= box.foot + 0.5 &&
          box.bar >= box.foot - 0.5,
      );
  await clear();
  for (let step = 1; step < count; step++) {
    await page.keyboard.press('k');
    await clear();
  }
  for (let step = 1; step < count; step++) {
    await page.keyboard.press('j');
    await clear();
  }
  await page.keyboard.press('Escape');
  await expect.poll(() => page.locator('.selection-bar').count()).toBe(0);
  // By pointer too: ticking the lowest row in full view keeps that row in view.
  await buttons.first().focus();
  const lowest = await page.evaluate(() => {
    const foot = document.querySelector('.pipeline-table-tray')!.getBoundingClientRect().bottom;
    const rows = [...document.querySelectorAll<HTMLElement>('tbody [data-table-row]')];
    return rows
      .filter((item) => item.getBoundingClientRect().bottom <= foot)
      .at(-1)
      ?.querySelector('[data-table-open]')
      ?.getAttribute('data-table-open');
  });
  await row(lowest!).getByRole('checkbox').click();
  await page.locator('.selection-bar').waitFor();
  await clear();
  await page.keyboard.press('Escape');
  await expect.poll(() => page.locator('.selection-bar').count()).toBe(0);
});

test('keeps Board | Table in the URL and on this device', async () => {
  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await expect.poll(() => page.url()).toContain('mode=board');
  await page.locator('.clay-columns').waitFor();
  expect(await page.locator('table.pipeline-table').count()).toBe(0);
  await page.reload();
  await page.locator('.clay-columns').waitFor();
  await page.goto(`${host.daemon.url}/pipeline`);
  await page.locator('.clay-columns').waitFor();
  await page.getByRole('button', { name: 'Table', exact: true }).click();
  await expect.poll(() => page.url()).toContain('mode=table');
  await page.goto(`${host.daemon.url}/pipeline`);
  await page.locator('table.pipeline-table').waitFor();
  expect(
    await page
      .getByRole('button', { name: /^All open/ })
      .first()
      .getAttribute('aria-pressed'),
  ).toBe('true');
});

test('evaluates fit for the whole Not scored page and reports every job', async () => {
  await page.goto(`${host.daemon.url}/pipeline?mode=table&view=not-scored`);
  await page.locator('table.pipeline-table').waitFor();
  await page.getByRole('checkbox', { name: 'Select every job on this page' }).click();
  await page.locator('.selection-bar').getByText('16 selected').waitFor();
  await page.getByRole('button', { name: 'Evaluate fit for 16 jobs' }).click();
  const result = page.getByRole('region', { name: 'Evaluate fit results' });
  await result.waitFor();
  expect(await result.locator('.bulk-result-summary').textContent()).toBe(
    '16 jobs · 10 queued · 3 already queued · 3 not sent',
  );
  await result.getByText('Each job is checked again when it starts.').waitFor();
  const lines = Object.fromEntries(
    await result
      .locator('li')
      .evaluateAll((items) =>
        items.map((item) => [
          item.querySelector('.bulk-result-company')?.textContent ?? '',
          item.querySelector('.bulk-result-text')?.textContent ?? '',
        ]),
      ),
  );
  for (const id of fixture.bare)
    expect(lines[fixture.companies[id]!]).toBe('Not sent · Prepare the job brief first.');
  expect(lines.Northwind).toBe('Already queued · 1st in line');
  expect(lines['Kestrel AI']).toBe('Already queued · 2nd in line');
  expect(lines.Corvid).toBe('Already queued · failed, waiting for Retry or Skip');
  const queued = fixture.briefs.map((id) => lines[fixture.companies[id]!]).toSorted();
  const places = ['3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
  expect(queued).toEqual(places.map((place) => `Queued · ${place} in line`).toSorted());
  expect(await result.getByRole('link', { name: /^Open entry for .+ in Queue$/ }).count()).toBe(3);
  // Jobs not sent stay selected; the rest left the selection.
  await page.locator('.selection-bar').getByText('3 selected').waitFor();
  // One fit request per lead with a brief, none for the three without.
  const data = await snapshot();
  const fits = new Map<string, number>();
  for (const queue of data.queue?.queues ?? [])
    if (queue.cardId)
      fits.set(
        queue.cardId,
        queue.requests.filter((request) => request.boardAction === 'fit').length,
      );
  for (const id of [...fixture.briefs, fixture.northwind, fixture.kestrel, fixture.corvid])
    expect(fits.get(id)).toBe(1);
  for (const id of fixture.bare) expect(fits.get(id) ?? 0).toBe(0);
}, 45000);

test('never says “Not sent” for a lost answer: queued once the snapshot shows it', async () => {
  // Two leads without a brief get one, so each can be sent.
  const [kite, larch] = fixture.bare as [string, string];
  for (const id of [kite, larch]) giveBrief(host.daemon.service, id);
  await page.goto(`${host.daemon.url}/pipeline?mode=table&view=not-scored`);
  await page.locator('table.pipeline-table').waitFor();
  // The daemon answers each fit, but the answer is lost on its way back (the page sees a network
  // failure). While `refresh` is off, the snapshot cannot be read either.
  await page.evaluate(() => {
    const real = window.fetch.bind(window);
    const lose = { refresh: true };
    Object.assign(window, { lose, realFetch: real });
    window.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (lose.refresh && url.includes('/api/snapshot')) throw new TypeError('Failed to fetch');
      const response = await real(input, init);
      if (url.includes('/api/queue/actions')) throw new TypeError('Failed to fetch');
      return response;
    };
  });
  const result = page.getByRole('region', { name: 'Evaluate fit results' });
  const fitsFor = async (id: string) =>
    (await snapshot()).queue?.queues
      .find((queue) => queue.cardId === id)
      ?.requests.filter((request) => request.boardAction === 'fit').length ?? 0;
  await row(kite).getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Evaluate fit for 1 job' }).click();
  // The refresh failed too, so nothing shows the request: unconfirmed, counted apart, selected.
  await expect
    .poll(() => result.locator('.bulk-result-summary').textContent())
    .toBe('1 job · 0 queued · 0 already queued · 0 not sent · 1 unconfirmed');
  expect(await result.locator('.bulk-result-text').allTextContents()).toEqual([
    'No answer from Pitchcrew · check this job’s queue before retrying',
  ]);
  // The line asks for a check, so it carries the way to make it.
  expect(
    await result.getByRole('link', { name: /^Check queue for .+$/ }).getAttribute('href'),
  ).toBe('/queue');
  expect(await result.getByText('Each job is checked again when it starts.').count()).toBe(0);
  await page.locator('.selection-bar').getByText('1 selected').waitFor();
  expect(await fitsFor(kite)).toBe(1);
  // The snapshot reads again: Kite's Queue cell shows the fit the lost answer queued, so the
  // retry the selection offers only finds it, and Larch's lost answer is told from the refresh.
  await page.evaluate(() => {
    (window as unknown as { lose: { refresh: boolean } }).lose.refresh = false;
  });
  await expect.poll(() => row(kite).locator('.queue-cell-text').textContent()).toMatch(/^Scout/);
  await row(larch).getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Evaluate fit for 2 jobs' }).click();
  await expect
    .poll(() => result.locator('.bulk-result-summary').textContent())
    .toBe('2 jobs · 1 queued · 1 already queued · 0 not sent');
  const said = await result
    .locator('.bulk-result-text')
    .evaluateAll((lines) => lines.map((line) => line.textContent));
  expect(said).toHaveLength(2);
  expect(said).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^Already queued · \d+\w\w in line$/),
      expect.stringMatching(/^Queued · \d+\w\w in line$/),
    ]),
  );
  // Both settled, so both left the selection; each job holds one fit request, never two.
  await expect.poll(() => page.locator('.selection-bar').count()).toBe(0);
  expect([await fitsFor(kite), await fitsFor(larch)]).toEqual([1, 1]);
  await page.evaluate(() => {
    window.fetch = (window as unknown as { realFetch: typeof fetch }).realFetch;
  });
}, 45000);

test('fits a phone without scrolling sideways, with 44px Queue controls', async () => {
  const phone = watch(
    await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }),
  );
  await phone.goto(`${host.daemon.url}/pipeline?mode=table`);
  await phone.locator('.pipeline-phone-list').waitFor({ timeout: 30000 });
  expect(
    await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await phone.getByRole('combobox', { name: 'View' }).waitFor();
  const heights = await phone
    .locator('.queue-cell-action')
    .evaluateAll((controls) =>
      controls
        .filter((control) => control.getBoundingClientRect().width > 0)
        .map((control) => control.getBoundingClientRect().height),
    );
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
  // Every row's fit ends on the same edge, whatever control its row carries (or none).
  const fitEdges = await phone
    .locator('.pipeline-phone-fit')
    .evaluateAll((fits) => fits.map((fit) => Math.round(fit.getBoundingClientRect().right)));
  expect(fitEdges.length).toBeGreaterThan(heights.length);
  expect(new Set(fitEdges).size).toBe(1);
  await phone.close();
});

test('logs no page errors or Base UI warnings', () => {
  expect(problems).toEqual([]);
});
