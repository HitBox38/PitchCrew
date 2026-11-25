import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { Snapshot } from '@pitchcrew/core';
import { cleanup, setup } from './helpers/daemon.ts';
import { seedAttention, type AttentionFixture } from './fixtures/attention.ts';

// Crew's At work lens on the shared attention cast: Writer's two running jobs and its question at
// once, Scout's queued fits grouped as a wait for a slot, Corvid's failure leading to Home, the
// Submitter's browser request, the idle fold, job-queue menus, the proposal left to CrewWaiting,
// the roster below with its fixed statuses, the sidebar's ochre bead, and the phone at 390. Checks
// that only read run first; the last ones navigate.
let host: Awaited<ReturnType<typeof setup>>;
let fixture: AttentionFixture;
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
/** The sidebar's Crew category starts closed; open it before the page loads. */
const openCrewCategory = (opened: Page) =>
  opened.addInitScript(() => {
    try {
      localStorage.setItem('pitchcrew-sidebar-category-crew-v1', 'true');
    } catch {
      /* The rows are still in the page, inside the closed category. */
    }
  });

beforeAll(async () => {
  host = await setup();
  fixture = await seedAttention(host.daemon.service);
  browser = await chromium.launch({ headless: true });
  page = watch(
    await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }),
  );
  await openCrewCategory(page);
  await page.goto(`${host.daemon.url}/crew`);
  await page.locator('.crew-lens-row').first().waitFor({ timeout: 30000 });
}, 90000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
}, 60000);

const lens = () => page.getByRole('region', { name: 'At work', exact: true });
const row = (agent: string, opened = page) =>
  opened.locator(`.crew-lens-row[data-agent="${agent}"]`);
const entry = (agent: string, subject: string) =>
  row(agent).locator('.crew-lens-entry').filter({ hasText: subject });
const snapshot = async () => (await host.request<Snapshot>('/snapshot?view=workspace')).result;
/** Where a link leads: its path and the Needs you item it opens, if any. */
const target = async (href: string | null) => {
  const url = new URL(href ?? '', host.daemon.url);
  return { path: url.pathname, item: url.searchParams.get('item') };
};

test('shows At work above the Agents roster, busy agents first by what waits on you', async () => {
  const headings = await page.locator('main h2').allInnerTexts();
  expect(headings.indexOf('At work')).toBeGreaterThanOrEqual(0);
  expect(headings.indexOf('At work')).toBeLessThan(headings.indexOf('Agents'));
  // What Crew's badge counts follows the lens, before the roster.
  const waiting = headings.findIndex((heading) => heading.startsWith('Waiting on you'));
  expect(waiting).toBeGreaterThan(headings.indexOf('At work'));
  expect(waiting).toBeLessThan(headings.indexOf('Agents'));
  await expect.poll(() => lens().locator('.crew-lens-row').count()).toBe(4);
  // Submitter's browser request ranks first in Needs you, then Corvid's failure, then the question.
  expect(
    await lens()
      .locator('.crew-lens-row')
      .evaluateAll((rows) => rows.map((item) => item.getAttribute('data-agent'))),
  ).toEqual(['submitter', 'scout', 'writer', 'reviewer']);
  // The lens has no count of its own; the title row says how many agents work. The shell's
  // default fact stays in the row, hidden behind Crew's own, so look for the visible one.
  expect(await lens().locator('.ui-count').count()).toBe(0);
  await page
    .getByText(/agents, 4 working$/)
    .filter({ visible: true })
    .waitFor();
});

test('ends each raised row where its entries end on a wide window, the idle tray with them', async () => {
  const edges = await lens().evaluate((section) => {
    const right = (element: Element | null) => Math.round(element!.getBoundingClientRect().right);
    const rows = [...section.querySelectorAll('.crew-lens-row')];
    return {
      lens: right(section),
      row: right(rows[0]!),
      // Each row's own right padding is all that lies past its entries.
      past: rows.map((item) => right(item) - right(item.querySelector('.crew-lens-entries'))),
      idle: right(section.querySelector('.crew-lens-idle')),
    };
  });
  expect(new Set(edges.past)).toEqual(new Set([8]));
  expect(edges.idle).toBe(edges.row);
  // Paper ground lies beside the lens, not an empty band inside its raised rows.
  expect(edges.lens - edges.row).toBeGreaterThan(100);
  // Waiting on you keeps the lens's width, its Updates only included, so the work column has one
  // right edge; the Agents roster below still spans the page.
  const right = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((element) => Math.round(element.getBoundingClientRect().right));
  expect(await right('.crew-waiting')).toBe(edges.row);
  expect(await right('.crew-waiting .ui-section-action')).toBe(edges.row);
  expect(await right('.crew-grid')).toBe(edges.lens);
});

test('shows an agent running two jobs and waiting on a question at once', async () => {
  const writer = row('writer');
  expect(await writer.locator('.crew-lens-entry').count()).toBe(3);
  const acme = entry('writer', 'Acme Robotics');
  expect(await acme.getAttribute('data-state')).toBe('running');
  expect(await acme.locator('.clay-bead[data-tone="plum"][data-live]').count()).toBe(1);
  const globex = entry('writer', 'Globex');
  expect(await globex.getAttribute('data-state')).toBe('running');
  expect(await globex.locator('.ui-chip').textContent()).toBe('Crew follow-up');
  expect(await globex.locator('.crew-lens-line').textContent()).toContain('for Reviewer');
  const umbra = entry('writer', 'Umbra Health');
  expect(await umbra.getAttribute('data-state')).toBe('asks');
  // Separators keep to the end of their line with a no-break space before them.
  expect(await umbra.textContent()).toContain('Waiting for your answer · slot released');
  expect(await umbra.locator('.clay-bead[data-tone="ochre"]:not([data-live])').count()).toBe(1);
  expect(await target(await umbra.locator('.crew-lens-open').getAttribute('href'))).toEqual({
    path: '/',
    item: `question:${fixture.questionId}`,
  });
  // Its pebble breathes while a run executes, with an ochre bead for the wait.
  expect(await writer.locator('.crew-lens-identity .crew-pebble[data-live]').count()).toBe(1);
  expect(
    await writer.locator('.crew-lens-identity .crew-pebble-bead[data-tone="ochre"]').count(),
  ).toBe(1);
});

test('groups the fits waiting for a slot and links the failure to Home', async () => {
  const group = row('scout').locator('.crew-lens-entry[data-group]');
  expect(await group.locator('.crew-lens-subject').textContent()).toBe(
    'Northwind, Kestrel AI, Tidepool',
  );
  expect(await group.locator('.crew-lens-detail').textContent()).toContain(
    'All 3 wait for a free work slot, not for Scout',
  );
  await group.locator('.crew-lens-open').click();
  await expect.poll(() => group.locator('.crew-lens-member').count()).toBe(3);
  expect(await group.locator('.crew-lens-member').first().getAttribute('href')).toBe('/queue');
  await group.locator('.crew-lens-open').click();
  const corvid = entry('scout', 'Corvid');
  expect(await corvid.getAttribute('data-state')).toBe('failed');
  expect(await corvid.locator('.clay-bead[data-tone="rose"]').count()).toBe(1);
  expect(await corvid.locator('.crew-lens-stamp [data-tone="rose"]').textContent()).toBe('failed');
  expect(await target(await corvid.locator('.crew-lens-open').getAttribute('href'))).toEqual({
    path: '/',
    item: `failure:${fixture.failedQueueId}`,
  });
});

test('shows the Submitter waiting for your OK, still and linked to its row in Needs you', async () => {
  const initech = entry('submitter', 'Initech');
  expect(await initech.getAttribute('data-state')).toBe('asks');
  expect(await initech.locator('.crew-lens-detail').textContent()).toContain('Waiting for your OK');
  expect(await initech.locator('.clay-bead[data-live]').count()).toBe(0);
  expect(await target(await initech.locator('.crew-lens-open').getAttribute('href'))).toEqual({
    path: '/',
    item: `browser:${fixture.approvalId}`,
  });
  // Nothing on Crew approves: the lens and the roster card only lead to Home.
  expect(
    await lens()
      .getByRole('button', { name: /^Approve/ })
      .count(),
  ).toBe(0);
  const tray = page.locator('.crew-card.submitter .crew-status[data-kind="approving"]');
  expect(await tray.textContent()).toContain('Waiting for your OK');
  expect(await target(await tray.getAttribute('href'))).toEqual({
    path: '/',
    item: `browser:${fixture.approvalId}`,
  });
});

test('names every control for its job queue, and folds idle agents together', async () => {
  const menus = lens().getByRole('button', { name: /queue actions/i });
  expect(
    (
      await menus.evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')))
    ).toSorted(),
  ).toEqual([
    'Job queue actions for Acme Robotics',
    'Job queue actions for Globex',
    'Job queue actions for Halcyon',
    'Job queue actions for Lumen Labs',
  ]);
  const roster = (await snapshot()).roles.filter((role) => !role.retiredAt).length;
  const idle = lens().locator('.crew-lens-idle-trigger');
  expect(await idle.getAttribute('aria-expanded')).toBe('false');
  expect(await idle.locator('strong').textContent()).toBe(`${roster - 4} idle`);
  await idle.click();
  await expect.poll(() => lens().locator('.crew-lens-idle-line').count()).toBe(roster - 4);
  await idle.click();
  expect((await page.content()).toLowerCase()).not.toContain('agent queue');
});

test('rings a job queue’s menu when the keyboard reaches it', async () => {
  await entry('scout', 'Lumen Labs').locator('.crew-lens-open').focus();
  await page.keyboard.press('Tab');
  const ring = await page.evaluate(() => {
    const focused = document.activeElement as HTMLElement | null;
    const style = focused ? getComputedStyle(focused) : null;
    return {
      label: focused?.getAttribute('aria-label'),
      visible: !!focused?.matches(':focus-visible'),
      outline: style ? `${style.outlineStyle} ${style.outlineWidth}` : '',
    };
  });
  expect(ring).toEqual({
    label: 'Job queue actions for Lumen Labs',
    visible: true,
    outline: 'solid 2px',
  });
});

test('leaves the Writer proposal to Waiting on you, never the lens', async () => {
  const waiting = page.getByRole('region', { name: /^Waiting on you/ });
  await waiting.getByText('Writer suggests a change to its role').waitFor();
  expect(await lens().textContent()).not.toContain('suggests');
  expect(await lens().textContent()).not.toContain('Checking the packet rules');
});

test('moves between one agent’s entries with the arrow keys, wrapping', async () => {
  const stops = row('writer').locator('[data-lens-stop]');
  await stops.first().focus();
  const focused = (index: number) =>
    stops.nth(index).evaluate((element) => element === document.activeElement);
  await page.keyboard.press('ArrowDown');
  expect(await focused(1)).toBe(true);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  expect(await focused(0)).toBe(true);
  await page.keyboard.press('ArrowUp');
  expect(await focused(2)).toBe(true);
});

test('keeps the roster: question first, other work named, Pause off while any run is running', async () => {
  const writer = page.locator('.crew-card.writer');
  const tray = writer.locator('.crew-status[data-kind="waiting"]');
  expect(await tray.textContent()).toContain('Waiting for your answer');
  expect(await tray.textContent()).toContain('Also working on 2 more jobs');
  await writer.getByRole('button', { name: 'Writer options', exact: true }).click();
  const pause = page.getByRole('menuitem', { name: /^(Pause|Resume) Writer$/ });
  expect(await pause.getAttribute('aria-disabled')).toBe('true');
  await page.keyboard.press('Escape');
  await pause.waitFor({ state: 'hidden' });
  // The sidebar puts the ochre wait before the plum spinner.
  const submitter = page.locator('.sidebar-crew-row[aria-label="Submitter, waiting for you"]');
  expect(await submitter.locator('.clay-bead[data-tone="ochre"]').count()).toBe(1);
  expect(await submitter.locator('.clay-job-spinner').count()).toBe(0);
  // The roster cards still open each agent's settings.
  await page.locator('.crew-card.scout .crew-card-name-button').click();
  await page.getByRole('dialog', { name: 'Scout', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close agent settings', exact: true }).click();
  await page.getByRole('dialog', { name: 'Scout', exact: true }).waitFor({ state: 'hidden' });
});

test('fits a phone: rows fold to one line, nothing scrolls sideways, every target is 44px', async () => {
  const phone = watch(
    await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
      isMobile: true,
      hasTouch: true,
    }),
  );
  await phone.goto(`${host.daemon.url}/crew`);
  await phone.locator('.crew-lens-row').first().waitFor();
  const sideways = () =>
    phone.evaluate(() => {
      const body = document.querySelector('.workspace-body')!;
      return [
        document.documentElement.scrollWidth <= innerWidth,
        body.scrollWidth <= body.clientWidth,
      ];
    });
  /** Every visible link and button of the lens that is shorter than a touch target. */
  const small = () =>
    phone.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.crew-lens a, .crew-lens button')]
        .filter((element) => element.checkVisibility({ visibilityProperty: true }))
        .filter((element) => element.getBoundingClientRect().height < 44)
        .map((element) => `${element.tagName} ${element.textContent?.trim().slice(0, 40)}`),
    );
  await expect.poll(() => phone.locator('.crew-lens-row[data-folds]').count()).toBe(4);
  expect(await sideways()).toEqual([true, true]);
  const scout = row('scout', phone).locator('.crew-lens-trigger');
  expect(await scout.getAttribute('aria-expanded')).toBe('false');
  expect(await scout.textContent()).toContain('Corvid');
  // Only the fact's state word takes the tone.
  expect(await scout.locator('.crew-lens-fact-word [data-tone="rose"]').textContent()).toBe(
    'failed',
  );
  for (const agent of ['submitter', 'scout', 'writer', 'reviewer'])
    await row(agent, phone).locator('.crew-lens-trigger').click();
  await expect
    .poll(() => row('writer', phone).locator('.crew-lens-open').first().isVisible())
    .toBe(true);
  await row('scout', phone).locator('.crew-lens-entry[data-group] .crew-lens-open').click();
  await row('scout', phone).locator('.crew-lens-member').first().waitFor();
  expect(await small()).toEqual([]);
  expect(await sideways()).toEqual([true, true]);
  await phone.close();
}, 45_000);

test('opens Home at the ask an entry waits on, not at Home’s top row', async () => {
  await entry('writer', 'Umbra Health').locator('.crew-lens-open').click();
  await page.locator('.needs-tray').waitFor();
  await expect
    .poll(() => page.locator('.needs-row[data-open]').getAttribute('data-needs-key'))
    .toBe(`question:${fixture.questionId}`);
});

test('logs no page errors or Base UI warnings', () => {
  expect(problems).toEqual([]);
});
