import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { deleteJob } from '../../board/src/index.ts';
import type { Card, Run } from '@pitchcrew/core';
import { cleanup, setup, confirmFixtureApplication } from './helpers/daemon.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
let card: Card;
let next: Card;
const errors: string[] = [];
const menuName = () => `Actions for ${card.title} at ${card.company}`;
const menu = () => page.getByRole('button', { name: menuName(), exact: true });
const focusedLabel = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label'));

beforeAll(async () => {
  host = await setup(14609);
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
}, 60000);

beforeEach(async () => {
  await page.unrouteAll({ behavior: 'wait' });
  host.daemon.service.controllers.delete('fixture-busy');
  for (const run of host.daemon.service.board.list<Run>('run'))
    if (run.status === 'running')
      host.daemon.service.board.record(
        'run',
        { ...run, status: 'cancelled' },
        'system',
        'Fixture cleanup',
      );
  for (const job of host.daemon.service.board.list<Card>('card'))
    deleteJob(host.daemon.service.board, job.id, 'user', 'Fixture cleanup');
  card = host.daemon.service.createCard({
    company: 'Fictional Studio',
    title: 'Engineer',
    url: 'https://example.com/fictional-job',
  });
  next = host.daemon.service.createCard({ company: 'Next Studio', title: 'Designer' });
  await page.goto(host.daemon.url, { waitUntil: 'domcontentloaded' });
  await page.locator('.job-actions-trigger').first().waitFor({ timeout: 30000 });
  const later = page.getByRole('button', { name: 'Set up later', exact: true });
  if (await later.isVisible()) await later.click();
  await menu().waitFor();
  await page.evaluate(() => document.fonts.ready);
}, 30000);

afterAll(async () => {
  await browser?.close();
  await cleanup();
});

test('the menu button follows card hover and opening it does not open details or drag', async () => {
  const job = page.locator(`#board-job-${card.id}`);
  const rects = () =>
    job.evaluate((element) => ({
      card: element.querySelector('.job-card')!.getBoundingClientRect().y,
      icon: element.querySelector('.job-actions-trigger')!.getBoundingClientRect().y,
    }));
  await page.mouse.move(10, 10);
  const before = await rects();
  await job.locator('.job-card').hover();
  await expect.poll(async () => (await rects()).card - before.card).toBeCloseTo(-4, 1);
  const after = await rects();
  expect(after.icon - before.icon).toBeCloseTo(-4, 1);
  expect(after.icon - after.card).toBeCloseTo(before.icon - before.card, 1);
  await menu().click();
  await page.locator('[data-slot="dropdown-menu-content"]').waitFor();
  expect(await page.getByRole('dialog').count()).toBe(0);
  expect(await page.locator('[data-dragging]').count()).toBe(0);
  await page.keyboard.press('Escape');
  await expect.poll(focusedLabel).toBe(menuName());
});

test('right-click opens actions at the pointer, supports copying and dismisses back to the card', async () => {
  const body = page.locator(`#board-job-${card.id} .job-card`);
  await body.click({ button: 'right', position: { x: 50, y: 40 } });
  const popup = page.locator('[data-slot="context-menu-content"]');
  await popup.waitFor();
  expect(await page.getByRole('dialog').count()).toBe(0);
  expect(await page.locator('[data-dragging]').count()).toBe(0);
  const box = (await popup.boundingBox())!;
  expect(box.width).toBeGreaterThan(200);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(1440);
  await page.keyboard.press('Escape');
  await expect.poll(focusedLabel).toBe(`Open ${card.title} at ${card.company}`);
  await body.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Copy job posting link', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(card.url);
  await body.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Open details', exact: true }).click();
  const details = page.getByRole('dialog', { name: 'Job details', exact: true });
  await details.locator('.job-summary').waitFor();
  await page.keyboard.press('Escape');
  await details.waitFor({ state: 'detached' });
});

test('right-click status submenu moves jobs and reopens closed jobs with board focus restoration', async () => {
  const body = () => page.locator(`#board-job-${card.id} .job-card`);
  await body().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Move to…', exact: true }).press('ArrowRight');
  await page.getByRole('menuitem', { name: 'Changes requested', exact: true }).press('Enter');
  await expect
    .poll(() => host.daemon.service.board.get<Card>('card', card.id).state)
    .toBe('changes_requested');
  await expect.poll(focusedLabel).toBe(menuName());
  await body().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Mark withdrawn', exact: true }).click();
  await expect.poll(() => menu().count()).toBe(0);
  await page.getByRole('button', { name: /^Closed/ }).click();
  await body().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Move to…', exact: true }).press('ArrowRight');
  await page.getByRole('menuitem', { name: 'New lead', exact: true }).press('Enter');
  await expect.poll(() => host.daemon.service.board.get<Card>('card', card.id).state).toBe('lead');
  const closed = page.getByRole('button', { name: /^Closed/ });
  await expect
    .poll(() => closed.evaluate((element) => element === document.activeElement))
    .toBe(true);
  expect(await closed.getAttribute('aria-pressed')).toBe('true');
  await page.locator('[data-slot="context-menu-content"]').waitFor({ state: 'detached' });
});

test('copying a posting link and recording withdrawal preserve the current view and restore focus', async () => {
  await menu().click();
  await page.getByRole('menuitem', { name: 'Copy job posting link', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(card.url);
  await menu().click();
  await page.getByRole('menuitem', { name: 'Mark withdrawn', exact: true }).click();
  await expect
    .poll(() => host.daemon.service.board.get<Card>('card', card.id).state)
    .toBe('withdrawn');
  await expect.poll(() => menu().count()).toBe(0);
  expect(
    await page.getByRole('button', { name: /^Pipeline \d/ }).getAttribute('aria-pressed'),
  ).toBe('true');
  await expect.poll(focusedLabel).toBe(`Actions for ${next.title} at ${next.company}`);
  expect(
    host.daemon.service.board.list<Run>('run').filter((run) => run.cardId === card.id),
  ).toEqual([]);
});

// CPU throttling and two delayed saves need their own bounded CI budget.
test('keyboard moves reach individual grouped statuses and reopen jobs without changing views', async ({
  onTestFinished,
}) => {
  const cdp = await page.context().newCDPSession(page);
  onTestFinished(async () => {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await cdp.detach();
  });
  // Exercise the submenu/board focus handoff under slower CI rendering.
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.route(
    `**/api/cards/${card.id}/status`,
    async (route) => {
      const response = await route.fetch();
      // Persistence can precede the response and the renderer's authoritative reload.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fulfill({ response });
    },
    { times: 1 },
  );
  await menu().focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Move to…', exact: true }).press('ArrowRight');
  await page.getByRole('menuitem', { name: 'Changes requested', exact: true }).press('Enter');
  await expect
    .poll(() => host.daemon.service.board.get<Card>('card', card.id).state)
    .toBe('changes_requested');
  // Focus returns after the action reload settles and re-enables the rendered trigger.
  await page.locator(`#board-job-${card.id} .job-actions-trigger:enabled`).waitFor();
  await expect.poll(focusedLabel).toBe(menuName());
  await menu().click();
  await page.getByRole('menuitem', { name: 'Mark withdrawn', exact: true }).click();
  await expect.poll(() => menu().count()).toBe(0);
  await page.getByRole('button', { name: /^Closed/ }).click();
  await page.route(
    `**/api/cards/${card.id}/status`,
    async (route) => {
      const response = await route.fetch();
      // Reopening removes the card optimistically, before the action can restore focus.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fulfill({ response });
    },
    { times: 1 },
  );
  await menu().focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Move to…', exact: true }).press('ArrowRight');
  await page.getByRole('menuitem', { name: 'New lead', exact: true }).press('Enter');
  await expect.poll(() => host.daemon.service.board.get<Card>('card', card.id).state).toBe('lead');
  await expect.poll(() => menu().count()).toBe(0);
  const closed = page.getByRole('button', { name: /^Closed/ });
  expect(await closed.getAttribute('aria-pressed')).toBe('true');
  await page.locator('[data-slot="dropdown-menu-content"]').waitFor({ state: 'detached' });
  // Optimistic removal and popup exit can both finish before the response/reload.
  await page.getByText('Moved to New lead', { exact: true }).waitFor();
  await expect
    .poll(() => closed.evaluate((element) => element === document.activeElement))
    .toBe(true);
}, 30000);

test.each(['dropdown', 'context'])(
  'deletion requires confirmation, keeps cancellation harmless and restores focus after removal (%s)',
  async (kind) => {
    if (kind === 'context')
      await page.locator(`#board-job-${card.id} .job-card`).click({ button: 'right' });
    else await menu().click();
    await page.getByRole('menuitem', { name: 'Delete job…', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete this job?' });
    await dialog.waitFor();
    const keep = dialog.getByRole('button', { name: 'Keep job', exact: true });
    await expect
      .poll(() => keep.evaluate((element) => element === document.activeElement))
      .toBe(true);
    await keep.click();
    expect(host.daemon.service.board.get<Card>('card', card.id)).toMatchObject({ id: card.id });
    await expect.poll(focusedLabel).toBe(menuName());
    if (kind === 'context')
      await page.locator(`#board-job-${card.id} .job-card`).click({ button: 'right' });
    else await menu().click();
    await page.getByRole('menuitem', { name: 'Delete job…', exact: true }).click();
    await dialog.getByRole('button', { name: 'Delete job', exact: true }).click();
    await expect
      .poll(() => host.daemon.service.board.list<Card>('card').some((job) => job.id === card.id))
      .toBe(false);
    await expect.poll(() => menu().count()).toBe(0);
    await expect.poll(focusedLabel).toBe(`Actions for ${next.title} at ${next.company}`);
    expect(host.daemon.service.board.history(card.id)[0].data).toMatchObject({
      deletedAt: expect.any(String),
    });
  },
);

test('a pending status save shows a loader, then restores the original card and focus on failure', async ({
  onTestFinished,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  onTestFinished(() => release());
  await page.route(`**/api/cards/${card.id}/status`, async (route) => {
    await gate;
    await route.fulfill({ status: 400, json: { error: 'Fictional save failed.' } });
  });
  await menu().click();
  await page.getByRole('menuitem', { name: 'Shortlist', exact: true }).click();
  const job = page.locator(`#board-job-${card.id}`);
  await job.getByRole('status').getByText('Moving to Shortlisted…', { exact: true }).waitFor();
  expect(await job.getByRole('status').locator('svg.spin').count()).toBe(1);
  expect(host.daemon.service.board.get<Card>('card', card.id).state).toBe('lead');
  release();
  await page.getByText('Fictional save failed.', { exact: true }).waitFor();
  await expect.poll(() => job.getByRole('status').count()).toBe(0);
  expect(host.daemon.service.board.get<Card>('card', card.id).state).toBe('lead');
  await expect.poll(focusedLabel).toBe(menuName());
  expect(await page.locator(`#board-job-${card.id}`).getAttribute('data-card-state')).toBe('lead');
});

test('deleting the last job closes confirmation and focuses the empty board’s Add job action', async () => {
  deleteJob(host.daemon.service.board, next.id, 'user', 'Remove extra fixture');
  await page.reload();
  await menu().click();
  await page.getByRole('menuitem', { name: 'Delete job…', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete job', exact: true }).click();
  await page.getByRole('heading', { name: 'Start with a job post', exact: true }).waitFor();
  const add = page.getByRole('button', { name: 'Add job', exact: true });
  await expect.poll(() => add.evaluate((element) => element === document.activeElement)).toBe(true);
  await expect
    .poll(() => page.getByRole('dialog', { name: 'Delete this job?', exact: true }).count())
    .toBe(0);
});

test.each(['dropdown', 'context'])(
  'attached chat work disables mutations but leaves the menu and cancellation available (%s)',
  async (kind) => {
    const controller = new AbortController();
    host.daemon.service.controllers.set('fixture-busy', controller);
    host.daemon.service.board.record(
      'run',
      {
        id: 'fixture-busy',
        cardId: card.id,
        roleId: 'scout',
        status: 'running',
        mode: 'chat',
        runtime: 'demo',
        message: 'Fictional active work',
        startedAt: new Date().toISOString(),
        finishedAt: null,
      } satisfies Run,
      'scout',
      'Fixture active chat',
    );
    await page.reload();
    if (kind === 'context')
      await page.locator(`#board-job-${card.id} .job-card`).click({ button: 'right' });
    else await menu().click();
    for (const name of ['Shortlist', 'Mark withdrawn', 'Delete job…', 'Move to…'])
      expect(
        await page.getByRole('menuitem', { name, exact: true }).getAttribute('aria-disabled'),
      ).toBe('true');
    await page.getByRole('menuitem', { name: 'Cancel run', exact: true }).click();
    await expect.poll(() => controller.signal.aborted).toBe(true);
  },
);

test('whole-card mouse dragging still records a status without opening details', async () => {
  const body = page.locator(`#board-job-${card.id} .job-card`);
  const rect = (await body.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 15, rect.y + rect.height / 2, { steps: 5 });
  const target = page.locator('[data-status="shortlisted"]');
  await target.waitFor();
  const destination = (await target.boundingBox())!;
  await page.mouse.move(
    destination.x + destination.width / 2,
    destination.y + destination.height / 2,
    { steps: 15 },
  );
  await page.mouse.up();
  await expect
    .poll(() => host.daemon.service.board.get<Card>('card', card.id).state)
    .toBe('shortlisted');
  expect(await page.getByRole('dialog').count()).toBe(0);
  expect(errors).toEqual([]);
});

test('crew shortcuts open required brief review and start an isolated run only after confirmation', async () => {
  await host.daemon.service.saveProfile(
    'experience.md',
    '# Experience\n\nBuilt fictional React interfaces.',
  );
  await page.reload();
  await menu().click();
  await page.getByRole('menuitem', { name: 'Evaluate fit', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('heading', { name: 'Application brief', exact: true })
    .waitFor();
  expect(
    host.daemon.service.board.list<Run>('run').filter((run) => run.cardId === card.id),
  ).toEqual([]);
  await confirmFixtureApplication(host.request, card.id);
  await page.reload();
  await menu().click();
  await page.getByRole('menuitem', { name: 'Evaluate fit', exact: true }).click();
  await expect.poll(() => host.daemon.service.board.get<Card>('card', card.id).fit).not.toBeNull();
  expect(host.daemon.service.board.list<Run>('run')).toContainEqual(
    expect.objectContaining({
      cardId: card.id,
      purpose: 'fit',
      runtime: 'demo',
    }),
  );
});

test('touch menus fit a phone viewport and reach off-screen statuses through internal scrolling', async () => {
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  mobile.on('pageerror', (error) => errors.push(error.message));
  try {
    await mobile.goto(host.daemon.url, { waitUntil: 'domcontentloaded' });
    await mobile.getByRole('button', { name: menuName(), exact: true }).tap();
    await mobile.getByRole('menuitem', { name: 'Move to…', exact: true }).tap();
    const popup = mobile.locator('[data-slot="dropdown-menu-sub-content"]');
    await popup.waitFor();
    await expect
      .poll(async () => {
        const box = await popup.boundingBox();
        return !!box && box.x >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844;
      })
      .toBe(true);
    await mobile.getByRole('menuitem', { name: 'No response', exact: true }).tap();
    await expect
      .poll(() => host.daemon.service.board.get<Card>('card', card.id).state)
      .toBe('ghosted');
    expect(
      await mobile.getByRole('button', { name: /^Pipeline \d/ }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(await mobile.locator('[data-dragging]').count()).toBe(0);
  } finally {
    await mobile.close();
  }
});

test('reduced motion keeps both the card and its menu button stationary on hover', async () => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  try {
    await page.reload();
    const job = page.locator(`#board-job-${card.id}`);
    await job.waitFor();
    const rects = () =>
      job.evaluate((element) => ({
        card: element.querySelector('.job-card')!.getBoundingClientRect().y,
        icon: element.querySelector('.job-actions-trigger')!.getBoundingClientRect().y,
      }));
    await page.mouse.move(10, 10);
    const before = await rects();
    await job.locator('.job-card').hover();
    expect(await rects()).toEqual(before);
    await menu().click();
    await page.locator('[data-slot="dropdown-menu-content"]').waitFor();
    expect(errors).toEqual([]);
  } finally {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
});
